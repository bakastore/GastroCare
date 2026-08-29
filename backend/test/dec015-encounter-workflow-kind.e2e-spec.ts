import { createLongoPathway, decisionFixture } from './dec016-fixtures';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DEC-015 — Encounter Workflow Discriminator v1 (application integration,
 * e2e, real PostgreSQL). Proves the persisted, EXPLICIT `Encounter.workflowKind`
 * behaviour: it is only ever what the caller explicitly sends, never
 * inferred (from reasonForVisit / clinical text / form existence / episode
 * ancestry), and is mutually exclusive with episodeId on create. Timeline
 * projection reads the persisted column only.
 */
describe('DEC-015 — Encounter Workflow Discriminator v1 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;
  let patientId: string;

  async function resetTables() {
    await prisma.auditEvent.deleteMany();
    await prisma.investigationResult.deleteMany();
    await prisma.investigationOrder.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.clinicalFormSubmission.deleteMany();
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

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  function postEncounter(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send(body);
  }

  async function createSubmission(
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId, templateKey, responses: decisionFixture(templateKey, responses) });
  }
  function completeSubmission(id: string) {
    return request(app.getHttpServer())
      .post(`/clinical-forms/${id}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`);
  }

  /** Initial Hemorrhoid branch through to a signed CarePlan + one OPEN
   * generic follow-up CareTask — the eligible input for POST
   * /encounters/hemorrhoid-return. */
  async function readyOpenFollowUpTask(reason: string): Promise<{
    initialEncounterId: string;
    careTaskId: string;
  }> {
    const enc = await postEncounter({
      patientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: reason,
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(201);
    const initialEncounterId = enc.body.id as string;
    const exam = await createSubmission(
      initialEncounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    await completeSubmission(exam.body.id);
    const diag = await createSubmission(initialEncounterId, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'x',
    });
    await completeSubmission(diag.body.id);
    const dec = await createSubmission(
      initialEncounterId,
      'HEMORRHOID_TREATMENT_DECISION',
      { decisionSummary: 'x' },
    );
    await completeSubmission(dec.body.id);
    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: initialEncounterId, instructions: 'x', followUpDate: '2026-11-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return { initialEncounterId, careTaskId: signed.body.careTask.id as string };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await resetTables();

    const tenant = await prisma.tenant.create({
      data: { name: 'DEC-015 Synthetic Tenant' },
    });
    tenantId = tenant.id;
    const doctorPassword = 'Dec015-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-dec015@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic DEC-015 Patient',
        normalizedFullName: 'synthetic dec-015 patient',
        dateOfBirth: new Date('1970-01-01'),
        gender: 'MALE',
        phone: 'DEC015-SYNTH-01',
        normalizedPhone: 'DEC015-SYNTH-01',
      },
    });
    patientId = patient.id;
    doctorToken = await login('doctor-dec015@gastrocare.test', doctorPassword);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('B1: generic ungrouped create (no workflowKind) persists workflowKind = NULL', async () => {
    const res = await postEncounter({
      patientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Đau thượng vị (synthetic B1)',
    }).expect(201);
    const row = await prisma.encounter.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.workflowKind).toBeNull();
    expect(row.episodeId).toBeNull();
  });

  it('B2: explicit workflowKind = HEMORRHOID_INITIAL persists HEMORRHOID_INITIAL', async () => {
    const res = await postEncounter({
      patientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Khám trĩ (synthetic B2)',
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(201);
    const row = await prisma.encounter.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.workflowKind).toBe('HEMORRHOID_INITIAL');
    expect(row.episodeId).toBeTruthy();
  });

  it('B3: an invalid workflowKind string is rejected by DTO validation (400)', async () => {
    await postEncounter({
      patientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Khám trĩ (synthetic B3)',
      workflowKind: 'HEMORRHOID_RANDOM',
    }).expect(400);
  });

  it('B4: legacy Longo episodeId + Initial workflowKind is rejected (409) and no Encounter is created', async () => {
    const episode = await prisma.careEpisode.create({
      data: { tenantId, patientId, episodeType: 'LONGO_TREATMENT', status: 'ACTIVE', startedAt: new Date() },
    });
    const before = await prisma.encounter.count({ where: { tenantId, episodeId: episode.id } });
    await postEncounter({
      patientId,
      episodeId: episode.id,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Khám (synthetic B4)',
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(409);
    const after = await prisma.encounter.count({ where: { tenantId, episodeId: episode.id } });
    expect(after).toBe(before);
    await prisma.careEpisode.delete({ where: { id: episode.id } });
  });

  it('B5: Longo episode-bound generic Encounter persists workflowKind = NULL; episodeType stays LONGO_TREATMENT', async () => {
    const episode={body:await prisma.careEpisode.findFirstOrThrow({where:{patientId,episodeType:'HEMORRHOID_TREATMENT'}})};
    const pathwayId=await createLongoPathway(app,doctorToken,episode.body.id);
    const res = await postEncounter({
      patientId,
      episodeId: episode.body.id,
      treatmentPathwayId:pathwayId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Khám tiền phẫu Longo (synthetic B5)',
    }).expect(201);
    const row = await prisma.encounter.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.workflowKind).toBeNull();
    const ep = await prisma.careEpisode.findUniqueOrThrow({ where: { id: episode.body.id } });
    expect(ep.episodeType).toBe('HEMORRHOID_TREATMENT');
  });

  it('B6: Hemorrhoid Return Encounter persists workflowKind = NULL; episodeType is HEMORRHOID_TREATMENT', async () => {
    const { careTaskId } = await readyOpenFollowUpTask('Khám trĩ (synthetic B6 initial)');
    const ret = await request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ careTaskId, occurredAt: new Date().toISOString(), reasonForVisit: 'Tái khám (synthetic B6)' })
      .expect(201);
    const row = await prisma.encounter.findUniqueOrThrow({ where: { id: ret.body.id } });
    expect(row.workflowKind).toBeNull();
    const ep = await prisma.careEpisode.findUniqueOrThrow({ where: { id: row.episodeId! } });
    expect(ep.episodeType).toBe('HEMORRHOID_TREATMENT');
  });

  it('B7: Timeline ENCOUNTER projection exposes the persisted workflowKind for every kind of Encounter', async () => {
    // Fresh isolated patient so the timeline is deterministic.
    const p = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic DEC-015 Timeline Patient',
        normalizedFullName: 'synthetic dec-015 timeline patient',
        dateOfBirth: new Date('1972-02-02'),
        gender: 'FEMALE',
        phone: 'DEC015-TL-01',
        normalizedPhone: 'DEC015-TL-01',
      },
    });

    // (a) explicit initial Hemorrhoid
    const initial = await postEncounter({
      patientId: p.id,
      occurredAt: '2026-09-01T09:00:00.000Z',
      reasonForVisit: 'Khám trĩ (B7 initial)',
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(201);
    // (b) generic ungrouped
    const generic = await postEncounter({
      patientId: p.id,
      occurredAt: '2026-09-02T09:00:00.000Z',
      reasonForVisit: 'Đau thượng vị (B7 generic)',
    }).expect(201);
    // (c) Longo episode-bound
    const longoEp={body:{id:initial.body.episodeId}};
    const longoPathwayId=await createLongoPathway(app,doctorToken,longoEp.body.id);
    const longoEnc = await postEncounter({
      patientId: p.id,
      episodeId: longoEp.body.id,
      treatmentPathwayId:longoPathwayId,
      occurredAt: '2026-09-03T10:00:00.000Z',
      reasonForVisit: 'Khám Longo (B7)',
    }).expect(201);
    // (d) Hemorrhoid Return
    const { careTaskId } = await readyOpenFollowUpTaskFor(p.id, 'Khám trĩ (B7 return initial)');
    const ret = await request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ careTaskId, occurredAt: '2026-09-05T09:00:00.000Z', reasonForVisit: 'Tái khám (B7)' })
      .expect(201);

    const timeline = await request(app.getHttpServer())
      .get(`/patients/${p.id}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const allEvents = [
      ...timeline.body.episodes.flatMap((g: { events: unknown[] }) => g.events),
      ...timeline.body.ungroupedEncounters,
    ] as { type: string; data: Record<string, unknown> }[];
    const byId = new Map(
      allEvents.filter((e) => e.type === 'ENCOUNTER').map((e) => [e.data.id, e.data]),
    );
    expect(byId.get(initial.body.id)?.workflowKind).toBe('HEMORRHOID_INITIAL');
    expect(byId.get(generic.body.id)?.workflowKind).toBeNull();
    expect(byId.get(longoEnc.body.id)?.workflowKind).toBeNull();
    expect(byId.get(ret.body.id)?.workflowKind).toBeNull();

    await prisma.patient.delete({ where: { id: p.id } }).catch(() => undefined);
  });

  it('B8: an ungrouped generic Encounter whose reasonForVisit says "Khám trĩ" but with NO workflowKind stays NULL (no text inference)', async () => {
    const res = await postEncounter({
      patientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: 'Khám trĩ nội độ II, đau rát hậu môn (synthetic B8)',
    }).expect(201);
    const row = await prisma.encounter.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.workflowKind).toBeNull();
  });

  /** B7 helper — same as readyOpenFollowUpTask but for an arbitrary patient. */
  async function readyOpenFollowUpTaskFor(
    forPatientId: string,
    reason: string,
  ): Promise<{ careTaskId: string }> {
    const enc = await postEncounter({
      patientId: forPatientId,
      occurredAt: new Date().toISOString(),
      reasonForVisit: reason,
      workflowKind: 'HEMORRHOID_INITIAL',
    }).expect(201);
    const encId = enc.body.id as string;
    const exam = await createSubmission(encId, 'HEMORRHOID_EXAMINATION', {});
    await completeSubmission(exam.body.id);
    const diag = await createSubmission(encId, 'HEMORRHOID_DIAGNOSIS', { diagnosisSummary: 'x' });
    await completeSubmission(diag.body.id);
    const dec = await createSubmission(encId, 'HEMORRHOID_TREATMENT_DECISION', {
      decisionSummary: 'x',
    });
    await completeSubmission(dec.body.id);
    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: encId, instructions: 'x', followUpDate: '2026-11-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return { careTaskId: signed.body.careTask.id as string };
  }
});
