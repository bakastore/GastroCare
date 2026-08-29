import { randomUUID } from 'node:crypto';
import { reconcile } from '../scripts/dec016-reconcile';
import { AuditService } from '../src/audit/audit.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('DEC-016 Case/Pathway/Investigation synthetic acceptance', () => {
  let app: INestApplication, prisma: PrismaService;
  let tenantId: string,
    otherTenantId: string,
    doctorId: string,
    nurseId: string;
  let token: string,
    nurseToken: string,
    otherToken: string,
    receptionToken: string;
  const at = '2026-08-28T09:00:00.000Z';
  const wexner = {
    longTermSolidStool: 0,
    longTermLiquidStool: 0,
    longTermGas: 0,
    longTermPadWearing: 0,
    longTermLifestyleAlteration: 0,
  };
  const post = (url: string, body: string | object, auth = token) =>
    request(app.getHttpServer())
      .post(url)
      .auth(auth, { type: 'bearer' })
      .send(body);
  const get = (url: string, auth = token) =>
    request(app.getHttpServer()).get(url).auth(auth, { type: 'bearer' });
  async function reset() {
    await prisma.investigationResult.deleteMany();
    await prisma.investigationOrder.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.careTask.deleteMany();
    await prisma.carePlanVersion.deleteMany();
    await prisma.carePlan.deleteMany();
    await prisma.clinicianAssignmentHistory.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.treatmentPathway.deleteMany();
    await prisma.careEpisode.deleteMany();
    await prisma.room.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.foundationProbeRecord.deleteMany();
    await prisma.authUser.deleteMany();
    await prisma.tenant.deleteMany();
  }
  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await reset();
    tenantId = (
      await prisma.tenant.create({ data: { name: 'DEC016 SYNTHETIC' } })
    ).id;
    otherTenantId = (
      await prisma.tenant.create({ data: { name: 'DEC016 SYNTHETIC OTHER' } })
    ).id;
    async function user(email: string, role: AuthRole, tenant = tenantId) {
      const u = await prisma.authUser.create({
        data: {
          email,
          role,
          tenantId: tenant,
          passwordHash: await bcrypt.hash('SyntheticOnly-016!', 4),
        },
      });
      const res = await post(
        '/auth/login',
        { email, password: 'SyntheticOnly-016!' },
        '',
      ).expect(200);
      return { id: u.id, token: res.body.accessToken as string };
    }
    const d = await user('d016@example.test', 'DOCTOR');
    doctorId = d.id;
    token = d.token;
    const n = await user('n016@example.test', 'NURSE');
    nurseId = n.id;
    nurseToken = n.token;
    otherToken = (await user('o016@example.test', 'DOCTOR', otherTenantId))
      .token;
    receptionToken = (await user('r016@example.test', 'RECEPTIONIST')).token;
  });
  afterAll(async () => {
    await reset();
    await app.close();
  });
  async function initial() {
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'SYNTHETIC DEC016',
        normalizedFullName: 'synthetic dec016',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
        phone: '0000000000',
        normalizedPhone: '0000000000',
      },
    });
    const e = await post('/encounters', {
      patientId: patient.id,
      occurredAt: at,
      reasonForVisit: 'synthetic',
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(201);
    return {
      patientId: patient.id,
      encounterId: e.body.id as string,
      caseId: e.body.episodeId as string,
    };
  }
  async function form(
    encounterId: string,
    templateKey: string,
    responses: object = {},
  ) {
    const f = await post('/clinical-forms', {
      encounterId,
      templateKey,
      responses,
    }).expect(201);
    await post(`/clinical-forms/${f.body.id}/complete`, {}).expect(201);
    return f.body;
  }
  async function pathway(caseId: string, methodCode = 'LONGO') {
    return (
      await post('/treatment-pathways', {
        caseId,
        modality: 'SURGERY',
        methodCode,
        startedAt: at,
      }).expect(201)
    ).body;
  }
  async function encounter(
    c: { patientId: string; caseId: string },
    treatmentPathwayId: string,
  ) {
    return (
      await post('/encounters', {
        patientId: c.patientId,
        episodeId: c.caseId,
        treatmentPathwayId,
        occurredAt: at,
        reasonForVisit: 'synthetic',
      }).expect(201)
    ).body;
  }
  async function plan(encounterId: string) {
    const p = await post('/care-plans', {
      encounterId,
      instructions: 'synthetic',
      followUpDate: '2026-09-01',
    }).expect(201);
    return (await post(`/care-plans/${p.body.id}/sign`, {}).expect(201)).body
      .careTask;
  }
  async function initialTask(c: { encounterId: string }) {
    await form(c.encounterId, 'HEMORRHOID_EXAMINATION');
    await form(c.encounterId, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    await form(c.encounterId, 'HEMORRHOID_TREATMENT_DECISION', {
      decisionSummary: 'synthetic',
      treatmentModalities: ['MEDICAL', 'SURGERY'],
      medicalCareSetting: 'synthetic clinic',
      surgeryCareSetting: 'HOSPITAL',
    });
    return plan(c.encounterId);
  }
  it('Initial immediately creates/reuses Case; text containing trĩ does not group generic Encounter', async () => {
    const c = await initial();
    expect(c.caseId).toBeTruthy();
    const e = await post('/encounters', {
      patientId: c.patientId,
      occurredAt: at,
      reasonForVisit: 'trĩ synthetic',
      workflowKind: 'HEMORRHOID_INITIAL',
      episodeId: c.caseId,
    }).expect(201);
    expect(e.body.episodeId).toBe(c.caseId);
    const generic = await post('/encounters', {
      patientId: c.patientId,
      occurredAt: at,
      reasonForVisit: 'trĩ synthetic',
    }).expect(201);
    expect(generic.body.episodeId).toBeNull();
    expect(generic.body.workflowKind).toBeNull();
    expect(
      await prisma.careEpisode.count({ where: { patientId: c.patientId } }),
    ).toBe(1);
  });
  it('retires direct Longo start; supports multiple explicit surgery methods with no default', async () => {
    const c = await initial();
    await post('/care-episodes', {
      patientId: c.patientId,
      episodeType: 'LONGO_TREATMENT',
      startedAt: at,
    }).expect(400);
    await post('/treatment-pathways', {
      caseId: c.caseId,
      modality: 'SURGERY',
      startedAt: at,
    }).expect(400);
    await post('/treatment-pathways', {
      caseId: c.caseId,
      modality: 'SURGERY',
      methodCode: 'UNKNOWN',
      startedAt: at,
    }).expect(400);
    for (const code of [
      'LONGO',
      'MILLIGAN_MORGAN',
      'FERGUSON',
      'HCPT',
      'LASER_DIODE_LHP',
      'THD_HAL_RAR',
    ])
      expect((await pathway(c.caseId, code)).methodCode).toBe(code);
    await post('/treatment-pathways', {
      caseId: c.caseId,
      modality: 'MEDICAL',
      startedAt: at,
    }).expect(201);
    await post('/treatment-pathways', {
      caseId: c.caseId,
      modality: 'PROCEDURE',
      startedAt: at,
    }).expect(201);
    await post('/treatment-pathways', {
      caseId: c.caseId,
      modality: 'MEDICAL',
      methodCode: 'LONGO',
      startedAt: at,
    }).expect(400);
  });
  it('Case + pathway ancestry rejects cross-tenant and cross-patient requests', async () => {
    const c = await initial(),
      d = await initial(),
      p = await pathway(c.caseId);
    await post(
      '/treatment-pathways',
      { caseId: c.caseId, modality: 'MEDICAL', startedAt: at },
      otherToken,
    ).expect(404);
    await get(
      `/care-episodes/${c.caseId}/treatment-pathways`,
      otherToken,
    ).expect(404);
    await post('/encounters', {
      patientId: d.patientId,
      episodeId: d.caseId,
      treatmentPathwayId: p.id,
      occurredAt: at,
      reasonForVisit: 'synthetic',
    }).expect(400);
    await post('/encounters', {
      patientId: c.patientId,
      treatmentPathwayId: p.id,
      occurredAt: at,
      reasonForVisit: 'synthetic',
    }).expect(400);
    await post(
      '/treatment-pathways',
      { caseId: c.caseId, modality: 'MEDICAL', startedAt: at },
      nurseToken,
    ).expect(403);
  });
  it('Longo forms require LONGO pathway; preop/intraop/postop retain all six families', async () => {
    const c = await initial(),
      p = await pathway(c.caseId),
      wrong = await pathway(c.caseId, 'FERGUSON');
    const e = await encounter(c, p.id),
      bad = await encounter(c, wrong.id);
    await post('/clinical-forms', {
      encounterId: bad.id,
      templateKey: 'LONGO_PREOP_ASSESSMENT',
      responses: {},
    }).expect(403);
    await post('/clinical-forms', {
      encounterId: c.encounterId,
      templateKey: 'LONGO_PREOP_ASSESSMENT',
      responses: {},
    }).expect(403);
    for (const key of [
      'LONGO_PREOP_ASSESSMENT',
      'LONGO_INTRAOP_RECORD',
      'LONGO_EARLY_POSTOP',
      'LONGO_TWO_WEEK_FOLLOWUP',
      'ANAL_DILATION_ASSESSMENT',
    ])
      await form(e.id, key);
    await form(e.id, 'LONGO_LONG_TERM_FOLLOWUP', {
      plannedTimepoint: 'MONTH_1',
      ...wexner,
    });
    expect(
      await prisma.clinicalFormSubmission.count({
        where: { encounterId: e.id, status: 'COMPLETED' },
      }),
    ).toBe(6);
  });
  it('two LONGO pathways cannot cross-complete Month 1/3/6 tasks', async () => {
    const c = await initial(),
      p = await pathway(c.caseId),
      q = await pathway(c.caseId);
    const s1 = await encounter(c, p.id),
      s2 = await encounter(c, q.id);
    await form(s1.id, 'LONGO_INTRAOP_RECORD');
    await form(s2.id, 'LONGO_INTRAOP_RECORD');
    const secondMonth1 = await prisma.careTask.findUniqueOrThrow({
      where: {
        sourceEncounterId_timepointCode: {
          sourceEncounterId: s2.id,
          timepointCode: 'MONTH_1',
        },
      },
    });
    // The generic completion endpoint cannot bypass pathway/timepoint forms.
    await post(`/care-tasks/${secondMonth1.id}/complete`, {
      completedByEncounterId: s1.id,
    }).expect(409);
    await post(`/care-tasks/${secondMonth1.id}/complete`, {}).expect(409);
    for (const tp of ['MONTH_1', 'MONTH_3', 'MONTH_6']) {
      const f = await encounter(c, p.id);
      await form(f.id, 'LONGO_LONG_TERM_FOLLOWUP', {
        plannedTimepoint: tp,
        ...wexner,
      });
      expect(
        (
          await prisma.careTask.findUniqueOrThrow({
            where: {
              sourceEncounterId_timepointCode: {
                sourceEncounterId: s1.id,
                timepointCode: tp,
              },
            },
          })
        ).completedByEncounterId,
      ).toBe(f.id);
      expect(
        (
          await prisma.careTask.findUniqueOrThrow({
            where: {
              sourceEncounterId_timepointCode: {
                sourceEncounterId: s2.id,
                timepointCode: tp,
              },
            },
          })
        ).status,
      ).toBe('OPEN');
    }
  });
  it('Return #1/#2 reuse source Case; close/reopen preserves atomic linkage and never creates Case on Return', async () => {
    const c = await initial();
    let task = await initialTask(c);
    for (let i = 0; i < 2; i++) {
      const r = await post('/encounters/hemorrhoid-return', {
        careTaskId: task.id,
        occurredAt: at,
        reasonForVisit: 'synthetic return',
      }).expect(201);
      expect(r.body.episodeId).toBe(c.caseId);
      expect(r.body.workflowKind).toBeNull();
      expect(
        (await prisma.careTask.findUniqueOrThrow({ where: { id: task.id } }))
          .completedByEncounterId,
      ).toBe(r.body.id);
      await form(r.body.id, 'HEMORRHOID_FOLLOW_UP_ASSESSMENT', {
        responseSummary: 'synthetic',
      });
      await form(r.body.id, 'HEMORRHOID_NEXT_CLINICAL_DECISION', {
        decisionSummary: 'synthetic',
      });
      task = await plan(r.body.id);
    }
    await post(`/care-episodes/${c.caseId}/close`, {}).expect(201);
    await post('/encounters/hemorrhoid-return', {
      careTaskId: task.id,
      occurredAt: at,
      reasonForVisit: 'synthetic return',
    }).expect(409);
    expect(
      (await prisma.careTask.findUniqueOrThrow({ where: { id: task.id } }))
        .status,
    ).toBe('OPEN');
    expect(
      await prisma.careEpisode.count({ where: { patientId: c.patientId } }),
    ).toBe(1);
    await post(`/care-episodes/${c.caseId}/reopen`, {
      reason: 'synthetic reopen',
    }).expect(201);
    await post('/encounters/hemorrhoid-return', {
      careTaskId: task.id,
      occurredAt: at,
      reasonForVisit: 'synthetic return',
    }).expect(201);
  });
  it('Treatment Decision v2 allows partial draft, validates COMPLETE/AMEND and never creates a pathway', async () => {
    const c = await initial();
    await form(c.encounterId, 'HEMORRHOID_EXAMINATION');
    await form(c.encounterId, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    const draft = await post('/clinical-forms', {
      encounterId: c.encounterId,
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      responses: {},
    }).expect(201);
    expect(draft.body.templateVersion).toBe(2);
    await post(`/clinical-forms/${draft.body.id}/complete`, {}).expect(400);
    const valid = {
      decisionSummary: 'synthetic combined decision',
      treatmentModalities: ['MEDICAL', 'SURGERY'],
      medicalCareSetting: 'synthetic clinic',
      surgeryCareSetting: 'HOSPITAL',
    };
    await request(app.getHttpServer())
      .patch(`/clinical-forms/${draft.body.id}/draft`)
      .auth(token, { type: 'bearer' })
      .send({ responses: valid })
      .expect(200);
    await post(`/clinical-forms/${draft.body.id}/complete`, {}).expect(201);
    await post(`/clinical-forms/${draft.body.id}/amend`, {
      responses: { ...valid, treatmentModalities: ['SURGERY'] },
      amendmentReason: 'synthetic',
    }).expect(400);
    await post(`/clinical-forms/${draft.body.id}/amend`, {
      responses: { ...valid, decisionSummary: 'synthetic corrected' },
      amendmentReason: 'synthetic',
    }).expect(201);
    expect(
      await prisma.treatmentPathway.count({ where: { caseId: c.caseId } }),
    ).toBe(0);
    expect(
      (
        await prisma.clinicalFormSubmission.findUniqueOrThrow({
          where: { id: draft.body.id },
        })
      ).responses,
    ).toEqual(valid);
    expect(
      (
        await get(
          '/clinical-forms/templates/HEMORRHOID_TREATMENT_DECISION?version=1',
        ).expect(200)
      ).body.version,
    ).toBe(1);
  });
  it('historical Treatment Decision v1 remains readable/amendable without fabricating v2 modalities', async () => {
    const c = await initial();
    await form(c.encounterId, 'HEMORRHOID_EXAMINATION');
    await form(c.encounterId, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    // Direct fixture models an existing v1 row; new API creation uses v2.
    const id = randomUUID();
    const original = await prisma.clinicalFormSubmission.create({
      data: {
        id,
        tenantId,
        patientId: c.patientId,
        encounterId: c.encounterId,
        actorId: doctorId,
        templateKey: 'HEMORRHOID_TREATMENT_DECISION',
        templateVersion: 1,
        status: 'COMPLETED',
        responses: { decisionSummary: 'synthetic legacy v1' },
        logicalGroupId: id,
        revisionNumber: 1,
        completedByUserId: doctorId,
        completedAt: new Date(at),
      },
    });
    expect(
      (await get(`/clinical-forms/${id}`).expect(200)).body.templateVersion,
    ).toBe(1);
    const amended = await post(`/clinical-forms/${id}/amend`, {
      responses: { decisionSummary: 'synthetic corrected v1' },
      amendmentReason: 'synthetic correction',
    }).expect(201);
    expect(amended.body.templateVersion).toBe(1);
    expect(amended.body.responses).toEqual({
      decisionSummary: 'synthetic corrected v1',
    });
    expect(
      await prisma.clinicalFormSubmission.findUniqueOrThrow({ where: { id } }),
    ).toEqual(original);
    expect(
      await prisma.treatmentPathway.count({ where: { caseId: c.caseId } }),
    ).toBe(0);
  });

  it('Treatment Decision v2 rejects orphan care settings even in DRAFT, and requires selected settings on COMPLETE', async () => {
    const c = await initial();
    await form(c.encounterId, 'HEMORRHOID_EXAMINATION');
    await form(c.encounterId, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    for (const extra of [
      { medicalCareSetting: 'clinic' },
      { procedureCareSetting: 'clinic' },
      { surgeryCareSetting: 'HOSPITAL' },
    ])
      await post('/clinical-forms', {
        encounterId: c.encounterId,
        templateKey: 'HEMORRHOID_TREATMENT_DECISION',
        responses: { decisionSummary: 'synthetic', ...extra },
      }).expect(400);
    const draft = await post('/clinical-forms', {
      encounterId: c.encounterId,
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      responses: {
        treatmentModalities: ['MEDICAL', 'PROCEDURE'],
        decisionSummary: 'synthetic',
      },
    }).expect(201);
    await post(`/clinical-forms/${draft.body.id}/complete`, {}).expect(400);
    for (const responses of [
      {
        treatmentModalities: ['SURGERY'],
        decisionSummary: 'synthetic',
        surgeryCareSetting: 'CLINIC',
      },
      {
        treatmentModalities: ['MEDICAL', 'MEDICAL'],
        decisionSummary: 'synthetic',
      },
    ])
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${draft.body.id}/draft`)
        .auth(token, { type: 'bearer' })
        .send({ responses })
        .expect(400);
  });
  it('Investigation Order → raw Result, explicit parent and prior evidence without fabricated local Order', async () => {
    const c = await initial();
    const inv = await post('/investigations', {
      caseId: c.caseId,
      origin: 'INTERNAL_CURRENT',
      label: 'synthetic test',
    }).expect(201);
    const order = await post(`/investigations/${inv.body.id}/orders`, {
      requestedAt: at,
      requestText: 'synthetic request',
      assignedToUserId: nurseId,
    }).expect(201);
    await post(
      `/investigations/${inv.body.id}/results`,
      {
        orderId: order.body.id,
        observedAt: at,
        rawText: 'synthetic raw value',
      },
      nurseToken,
    ).expect(201);
    const prior = await post('/investigations', {
      caseId: c.caseId,
      origin: 'EXTERNAL_PRIOR',
      label: 'synthetic prior',
      parentInvestigationId: inv.body.id,
    }).expect(201);
    await post(`/investigations/${prior.body.id}/results`, {
      observedAt: at,
      rawText: 'synthetic prior raw value',
    }).expect(201);
    const eco = await post('/investigations', {
      caseId: c.caseId,
      origin: 'ECOSYSTEM_PRIOR',
      label: 'synthetic ecosystem',
    }).expect(201);
    await post(`/investigations/${eco.body.id}/results`, {
      observedAt: at,
      rawText: 'synthetic prior',
    }).expect(201);
    expect(
      await prisma.investigationOrder.count({
        where: { investigationId: prior.body.id },
      }),
    ).toBe(0);
    await post(`/investigations/${prior.body.id}/orders`, {
      requestedAt: at,
      requestText: 'synthetic',
    }).expect(400);
    expect(
      (await get(`/investigations/${prior.body.id}`).expect(200)).body
        .parentInvestigationId,
    ).toBe(inv.body.id);
    const audit = await prisma.auditEvent.findMany({
      where: { tenantId, entityType: 'InvestigationResult' },
    });
    expect(JSON.stringify(audit)).not.toContain('synthetic raw value');
  });
  it('NURSE reads only assigned Investigation context and cannot access clinical forms or broad patient/Case data', async () => {
    const c = await initial();
    const inv = await post('/investigations', {
      caseId: c.caseId,
      origin: 'INTERNAL_CURRENT',
      label: 'synthetic',
    }).expect(201);
    await get(`/investigations/${inv.body.id}`, nurseToken).expect(404);
    const own = await post(`/investigations/${inv.body.id}/orders`, {
      requestedAt: at,
      requestText: 'synthetic assigned',
      assignedToUserId: nurseId,
    }).expect(201);
    const other = await post(`/investigations/${inv.body.id}/orders`, {
      requestedAt: at,
      requestText: 'doctor private order',
      assignedToUserId: doctorId,
    }).expect(201);
    await post(
      `/investigations/${inv.body.id}/results`,
      { orderId: other.body.id, observedAt: at, rawText: 'synthetic' },
      nurseToken,
    ).expect(403);
    const view = (
      await get(`/investigations/${inv.body.id}`, nurseToken).expect(200)
    ).body;
    expect(view.orders.map((o: any) => o.id)).toEqual([own.body.id]);
    expect(view.patient.phone).toBeUndefined();
    expect(view.patient.clinicalNote).toBeUndefined();
    for (const url of [
      '/patients',
      `/patients/${c.patientId}`,
      `/patients/${c.patientId}/timeline`,
      `/care-episodes/${c.caseId}`,
      `/clinical-forms?patientId=${c.patientId}`,
    ])
      await get(url, nurseToken).expect(403);
    for (const templateKey of [
      'HEMORRHOID_DIAGNOSIS',
      'HEMORRHOID_TREATMENT_DECISION',
    ])
      await post(
        '/clinical-forms',
        { encounterId: c.encounterId, templateKey, responses: {} },
        nurseToken,
      ).expect(403);
    await post(
      '/investigations',
      { caseId: c.caseId, origin: 'INTERNAL_CURRENT', label: 'synthetic' },
      nurseToken,
    ).expect(403);
    await get(`/investigations/${inv.body.id}`, receptionToken).expect(403);
    expect(
      (await get('/investigations/assigned', nurseToken).expect(200)).body.some(
        (i: any) => i.id === inv.body.id,
      ),
    ).toBe(true);
  });
  it('Investigation rejects cycles, cross-Case parents, mismatched Orders and cross-tenant reads/writes', async () => {
    const c = await initial(),
      d = await initial();
    const a = (
      await post('/investigations', {
        caseId: c.caseId,
        origin: 'INTERNAL_CURRENT',
        label: 'synthetic',
      }).expect(201)
    ).body;
    const b = (
      await post('/investigations', {
        caseId: c.caseId,
        origin: 'INTERNAL_CURRENT',
        label: 'synthetic',
        parentInvestigationId: a.id,
      }).expect(201)
    ).body;
    await request(app.getHttpServer())
      .patch(`/investigations/${a.id}/parent`)
      .auth(token, { type: 'bearer' })
      .send({ parentInvestigationId: b.id })
      .expect(400);
    await post('/investigations', {
      caseId: d.caseId,
      origin: 'INTERNAL_CURRENT',
      label: 'synthetic',
      parentInvestigationId: a.id,
    }).expect(400);
    const order = (
      await post(`/investigations/${a.id}/orders`, {
        requestedAt: at,
        requestText: 'synthetic',
      }).expect(201)
    ).body;
    await post(`/investigations/${b.id}/results`, {
      orderId: order.id,
      observedAt: at,
      rawText: 'synthetic',
    }).expect(400);
    await post(`/investigations/${a.id}/results`, {
      observedAt: at,
      rawText: 'synthetic',
    }).expect(400);
    await get(`/investigations/${a.id}`, otherToken).expect(404);
    await post(
      `/investigations/${a.id}/results`,
      { orderId: order.id, observedAt: at, rawText: 'synthetic' },
      otherToken,
    ).expect(404);
    expect(
      await prisma.investigationResult.count({
        where: { investigationId: { in: [a.id, b.id] } },
      }),
    ).toBe(0);
  });

  it('migrated synthetic Run2 projects one Case + nested legacy pathway, generic B ungrouped, no fabricated Diagnosis/Decision', async () => {
    const c = await initial();
    // Explicit PRE-style synthetic fixture, not inferred Owner Run2 data.
    await prisma.encounter.update({
      where: { id: c.encounterId },
      data: { episodeId: null },
    });
    const legacy = await prisma.careEpisode.create({
      data: {
        tenantId,
        patientId: c.patientId,
        episodeType: 'LONGO_TREATMENT',
        startedAt: new Date(at),
      },
    });
    const old = await prisma.encounter.create({
      data: {
        tenantId,
        patientId: c.patientId,
        episodeId: legacy.id,
        responsibleClinicianId: doctorId,
        createdByUserId: doctorId,
        occurredAt: new Date(at),
        reasonForVisit: 'synthetic legacy',
      },
    });
    const generic = (
      await post('/encounters', {
        patientId: c.patientId,
        occurredAt: at,
        reasonForVisit: 'trĩ synthetic generic B',
      }).expect(201)
    ).body;
    const pathId = randomUUID();
    await reconcile(prisma, {
      authority: 'DEC-016',
      syntheticOnly: true,
      id: randomUUID(),
      appliedAt: at,
      entries: [
        {
          tenantId,
          patientId: c.patientId,
          actorId: doctorId,
          caseId: c.caseId,
          initialEncounterIds: [c.encounterId],
          legacyPathways: [
            {
              legacyEpisodeId: legacy.id,
              pathwayId: pathId,
              encounterIds: [old.id],
            },
          ],
        },
      ],
    });
    const timeline = (
      await get(`/patients/${c.patientId}/timeline`).expect(200)
    ).body;
    expect(timeline.episodes).toHaveLength(1);
    expect(timeline.episodes[0].episode.id).toBe(c.caseId);
    expect(timeline.episodes[0].episode.treatmentPathways[0]).toMatchObject({
      id: pathId,
      legacyEpisodeId: legacy.id,
      methodCode: 'LONGO',
    });
    expect(
      timeline.ungroupedEncounters.find(
        (e: any) => e.type === 'ENCOUNTER' && e.data.id === generic.id,
      ),
    ).toBeTruthy();
    expect(
      await prisma.clinicalFormSubmission.count({
        where: { patientId: c.patientId },
      }),
    ).toBe(0);
    expect(
      await prisma.careEpisode.findUnique({ where: { id: legacy.id } }),
    ).not.toBeNull();
  });
  it('concurrent Initial requests never create two ACTIVE Cases', async () => {
    const p = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'SYNTHETIC INITIAL RACE',
        normalizedFullName: 'synthetic initial race',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
        phone: '0000000000',
        normalizedPhone: '0000000000',
      },
    });
    const payload = {
      patientId: p.id,
      occurredAt: at,
      reasonForVisit: 'synthetic',
      workflowKind: 'HEMORRHOID_INITIAL',
    };
    const rs = await Promise.all([
      post('/encounters', payload),
      post('/encounters', payload),
    ]);
    expect(rs.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(rs.some((r) => r.status === 201)).toBe(true);
    expect(
      await prisma.careEpisode.count({
        where: { tenantId, patientId: p.id, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });
  it('Initial audit failure rolls back the new Case, Encounter and assignment', async () => {
    const p = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'SYNTHETIC ROLLBACK',
        normalizedFullName: 'synthetic rollback',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'OTHER',
        phone: '0000000000',
        normalizedPhone: '0000000000',
      },
    });
    const audit = app.get(AuditService),
      record = audit.record.bind(audit);
    const spy = jest
      .spyOn(audit, 'record')
      .mockImplementation(async (input, tx) => {
        if (input.action === 'ENCOUNTER_CREATED')
          throw new Error('DEC016 injected synthetic failure');
        return record(input, tx);
      });
    try {
      await post('/encounters', {
        patientId: p.id,
        occurredAt: at,
        reasonForVisit: 'synthetic',
        workflowKind: 'HEMORRHOID_INITIAL',
      }).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.careEpisode.count({ where: { patientId: p.id } })).toBe(
      0,
    );
    expect(await prisma.encounter.count({ where: { patientId: p.id } })).toBe(
      0,
    );
    expect(
      await prisma.clinicianAssignmentHistory.count({
        where: { encounter: { patientId: p.id } },
      }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { tenantId, metadata: { path: ['patientId'], equals: p.id } },
      }),
    ).toBe(0);
  });
});
