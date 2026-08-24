import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-04 T5-T9 — the remaining five Longo form families
 * (LONGO_INTRAOP_RECORD, LONGO_EARLY_POSTOP, LONGO_TWO_WEEK_FOLLOWUP,
 * ANAL_DILATION_ASSESSMENT, LONGO_LONG_TERM_FOLLOWUP).
 *
 * The episode-ancestry invariant and the generic DRAFT/COMPLETE/amend
 * lifecycle machinery are already proven independently per-mechanism in
 * core04-t4-preop-assessment.e2e-spec.ts (T4) and clinical-forms.e2e-spec.ts
 * (T2). This file focuses on what is NEW/specific to T5-T9: each of the
 * five templates is reachable end-to-end from a real Episode, and the
 * template-specific clinical-safety rules the contract locks (no Wexner at
 * two weeks, Wexner + plannedTimepoint at long-term, no structured dilation
 * scale, repeatable dilation occurrences) hold through the real HTTP API,
 * not just in template unit specs. Synthetic data only.
 */
describe('CORE-04 T5-T9 — remaining five Longo form families (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let patientId: string;
  let doctorToken: string;
  let episodeId: string;

  async function resetTables() {
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.careTask.deleteMany();
    await prisma.carePlanVersion.deleteMany();
    await prisma.carePlan.deleteMany();
    await prisma.clinicianAssignmentHistory.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.careEpisode.deleteMany();
    await prisma.room.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.foundationProbeRecord.deleteMany();
    await prisma.authUser.deleteMany();
    await prisma.tenant.deleteMany();
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function createEncounter(occurredAt: string, reasonForVisit: string) {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        occurredAt,
        reasonForVisit,
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);
    return res.body.id as string;
  }

  async function createSubmission(
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown>,
  ) {
    const res = await request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId, templateKey, responses })
      .expect(201);
    return res.body.id as string;
  }

  async function completeSubmission(id: string) {
    const res = await request(app.getHttpServer())
      .post(`/clinical-forms/${id}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return res.body;
  }

  beforeAll(async () => {
    // Finding 3 correction — default clinician resolution is fail-closed
    // and requires an explicit config pointing at a real seeded DOCTOR;
    // set it before app bootstrap so ConfigModule picks it up.
    process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = 'doctor@core04-t5t9.example.test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await resetTables();

    const tenant = await prisma.tenant.create({
      data: { name: 'CORE-04 T5-T9 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Core04T5T9-Doctor-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor@core04-t5t9.example.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic T5-T9 Patient',
        normalizedFullName: 'synthetic t5-t9 patient',
        dateOfBirth: new Date('1975-05-05'),
        gender: 'FEMALE',
        phone: '0900000601',
        normalizedPhone: '0900000601',
      },
    });
    patientId = patient.id;

    doctorToken = await login('doctor@core04-t5t9.example.test', doctorPassword);

    const episodeRes = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeType: 'LONGO_TREATMENT',
        startedAt: '2026-01-01T02:00:00.000Z',
      })
      .expect(201);
    episodeId = episodeRes.body.id;
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
    delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
  });

  describe('A0. Template schema endpoint (frontend generic form renderer)', () => {
    it.each([
      'LONGO_INTRAOP_RECORD',
      'LONGO_EARLY_POSTOP',
      'LONGO_TWO_WEEK_FOLLOWUP',
      'ANAL_DILATION_ASSESSMENT',
      'LONGO_LONG_TERM_FOLLOWUP',
    ])('%s template schema is readable and has sections', async (templateKey) => {
      const res = await request(app.getHttpServer())
        .get(`/clinical-forms/templates/${templateKey}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      expect(res.body.templateKey).toBe(templateKey);
      expect(Array.isArray(res.body.sections)).toBe(true);
      expect(res.body.sections.length).toBeGreaterThan(0);
    });

    it('unknown templateKey returns 404', async () => {
      await request(app.getHttpServer())
        .get('/clinical-forms/templates/NOT_A_REAL_TEMPLATE')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(404);
    });
  });

  describe('A. Episode ancestry invariant also live for T5-T9 (create rejected without Episode)', () => {
    it.each([
      'LONGO_INTRAOP_RECORD',
      'LONGO_EARLY_POSTOP',
      'LONGO_TWO_WEEK_FOLLOWUP',
      'ANAL_DILATION_ASSESSMENT',
      'LONGO_LONG_TERM_FOLLOWUP',
    ])('%s create rejected when Encounter.episodeId is null', async (templateKey) => {
      const encounterRes = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          occurredAt: '2026-01-02T02:00:00.000Z',
          reasonForVisit: 'Synthetic ungrouped encounter',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ encounterId: encounterRes.body.id, templateKey, responses: {} })
        .expect(403);
    });
  });

  describe('B. T5 — LONGO_INTRAOP_RECORD full lifecycle on the Surgery Encounter', () => {
    let surgeryEncounterId: string;
    let submissionId: string;
    const surgeryOccurredAt = '2026-02-01T07:00:00.000Z';

    it('creates the Surgery Encounter and a DRAFT intraop submission', async () => {
      surgeryEncounterId = await createEncounter(
        surgeryOccurredAt,
        'Phẫu thuật Longo (dữ liệu giả lập)',
      );
      submissionId = await createSubmission(
        surgeryEncounterId,
        'LONGO_INTRAOP_RECORD',
        { operativeDurationMinutes: 45 },
      );
    });

    it('completes with the full field set and does not fabricate a score', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          responses: {
            anesthesiaNote: 'Vô cảm toàn thân (dữ liệu giả lập)',
            operativeDurationMinutes: 45,
            bloodLossMl: 30,
            additionalProceduresNote: 'Không',
            staplerSpecimenFindings: 'Bình thường (dữ liệu giả lập)',
            intraopComplicationsPresent: false,
          },
        })
        .expect(200);

      const completed = await completeSubmission(submissionId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.computedScores).toEqual({});
    });

    it('surgery Encounter.occurredAt is the exact anchor value supplied — never createdAt', async () => {
      const encounter = await prisma.encounter.findUniqueOrThrow({
        where: { id: surgeryEncounterId },
      });
      expect(encounter.occurredAt.toISOString()).toBe(surgeryOccurredAt);
      expect(encounter.occurredAt.getTime()).not.toBe(
        encounter.createdAt.getTime(),
      );
    });
  });

  describe('C. T6 — LONGO_EARLY_POSTOP attached to the same clinical occurrence', () => {
    it('creates and completes on the same Surgery Encounter (no new Encounter required)', async () => {
      const surgeryEncounter = await prisma.encounter.findFirstOrThrow({
        where: { tenantId, patientId, episodeId },
        orderBy: { occurredAt: 'asc' },
      });

      const submissionId = await createSubmission(
        surgeryEncounter.id,
        'LONGO_EARLY_POSTOP',
        { earlyPostopPainVas: 3 },
      );

      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          responses: {
            earlyPostopPainVas: 3,
            analgesicsUsed: true,
            bleeding: false,
            urinaryRetention: false,
            fever: false,
            prolapse: false,
            constipation: false,
            diarrhea: false,
            tenesmus: false,
            firstBowelMovementNote: 'Ngày thứ 2 sau mổ (dữ liệu giả lập)',
            stoolBloodPresent: false,
          },
        })
        .expect(200);

      const completed = await completeSubmission(submissionId);
      expect(completed.status).toBe('COMPLETED');
    });

    it('rejects a pain VAS value outside the locked 0-10 range at completion', async () => {
      const surgeryEncounter = await prisma.encounter.findFirstOrThrow({
        where: { tenantId, patientId, episodeId },
        orderBy: { occurredAt: 'asc' },
      });
      const otherEncounterId = await createEncounter(
        '2026-02-03T07:00:00.000Z',
        'Synthetic secondary encounter for out-of-range VAS check',
      );
      void surgeryEncounter;

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          encounterId: otherEncounterId,
          templateKey: 'LONGO_EARLY_POSTOP',
          responses: { earlyPostopPainVas: 15 },
        })
        .expect(400);
    });
  });

  describe('D. T7 — LONGO_TWO_WEEK_FOLLOWUP has no Wexner reachable via the API', () => {
    let twoWeekEncounterId: string;

    it('creates and completes without any Wexner field, and a submitted Wexner-shaped key is rejected as unknown', async () => {
      twoWeekEncounterId = await createEncounter(
        '2026-02-15T02:00:00.000Z',
        'Tái khám 2 tuần (dữ liệu giả lập)',
      );

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          encounterId: twoWeekEncounterId,
          templateKey: 'LONGO_TWO_WEEK_FOLLOWUP',
          responses: { twoWeekWexnerSolidStool: 2 },
        })
        .expect(400);

      const submissionId = await createSubmission(
        twoWeekEncounterId,
        'LONGO_TWO_WEEK_FOLLOWUP',
        {
          twoWeekPainVas: 1,
          bleeding: false,
          prolapse: false,
          skinTags: false,
          earlyAnalStenosis: false,
          twoWeekDilationPerformed: false,
        },
      );
      const completed = await completeSubmission(submissionId);
      expect(completed.status).toBe('COMPLETED');
      expect(completed.computedScores).toEqual({});
    });
  });

  describe('E. T8 — ANAL_DILATION_ASSESSMENT is repeatable, each session its own Encounter', () => {
    it('two separate dilation sessions each get their own Encounter + submission, neither overwrites the other', async () => {
      const session1EncounterId = await createEncounter(
        '2026-03-01T02:00:00.000Z',
        'Nong hậu môn lần 1 (dữ liệu giả lập)',
      );
      const session1Id = await createSubmission(
        session1EncounterId,
        'ANAL_DILATION_ASSESSMENT',
        {
          analDiameterNote: 'Lần 1: 1.5cm (dữ liệu giả lập)',
          dilationResistanceNote: 'Nhẹ',
          dilationPainNote: 'Ít đau',
          dilationBleedingNote: 'Không',
          defecationAbilityNote: 'Bình thường',
        },
      );
      await completeSubmission(session1Id);

      const session2EncounterId = await createEncounter(
        '2026-03-15T02:00:00.000Z',
        'Nong hậu môn lần 2 (dữ liệu giả lập)',
      );
      const session2Id = await createSubmission(
        session2EncounterId,
        'ANAL_DILATION_ASSESSMENT',
        {
          analDiameterNote: 'Lần 2: 1.8cm (dữ liệu giả lập)',
          dilationResistanceNote: 'Không đáng kể',
          dilationPainNote: 'Không đau',
          dilationBleedingNote: 'Không',
          defecationAbilityNote: 'Tốt',
        },
      );
      await completeSubmission(session2Id);

      expect(session1EncounterId).not.toBe(session2EncounterId);
      const session1 = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: session1Id },
      });
      const session2 = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: session2Id },
      });
      expect(
        (session1.responses as Record<string, unknown>).analDiameterNote,
      ).toBe('Lần 1: 1.5cm (dữ liệu giả lập)');
      expect(
        (session2.responses as Record<string, unknown>).analDiameterNote,
      ).toBe('Lần 2: 1.8cm (dữ liệu giả lập)');
      expect(session1.computedScores).toEqual({});
      expect(session2.computedScores).toEqual({});
    });
  });

  describe('F. T9 — LONGO_LONG_TERM_FOLLOWUP: plannedTimepoint + Wexner at MONTH_1/MONTH_3/MONTH_6', () => {
    const wexnerFull = {
      longTermSolidStool: 1,
      longTermLiquidStool: 1,
      longTermGas: 0,
      longTermPadWearing: 0,
      longTermLifestyleAlteration: 1,
    };

    it('completion is rejected when plannedTimepoint is missing', async () => {
      const encounterId = await createEncounter(
        '2026-04-01T02:00:00.000Z',
        'Tái khám tháng 1 (dữ liệu giả lập)',
      );
      const submissionId = await createSubmission(
        encounterId,
        'LONGO_LONG_TERM_FOLLOWUP',
        { ...wexnerFull },
      );
      await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(400);
    });

    it.each([
      ['MONTH_1', '2026-04-01T02:00:00.000Z'],
      ['MONTH_3', '2026-06-01T02:00:00.000Z'],
      ['MONTH_6', '2026-09-01T02:00:00.000Z'],
    ])(
      '%s: completes with plannedTimepoint + full Wexner, deterministic total is server-computed',
      async (plannedTimepoint, occurredAt) => {
        const encounterId = await createEncounter(
          occurredAt,
          `Tái khám ${plannedTimepoint} (dữ liệu giả lập)`,
        );
        const submissionId = await createSubmission(
          encounterId,
          'LONGO_LONG_TERM_FOLLOWUP',
          { plannedTimepoint, ...wexnerFull },
        );

        const completed = await completeSubmission(submissionId);
        expect(completed.status).toBe('COMPLETED');
        expect(completed.responses.plannedTimepoint).toBe(plannedTimepoint);
        expect(completed.computedScores.longTermTotal).toBe(3);
      },
    );

    it('a client-submitted total is ignored — server always recomputes from items', async () => {
      const encounterId = await createEncounter(
        '2026-04-02T02:00:00.000Z',
        'Tái khám tháng 1 - bổ sung (dữ liệu giả lập)',
      );
      const submissionId = await createSubmission(
        encounterId,
        'LONGO_LONG_TERM_FOLLOWUP',
        { plannedTimepoint: 'MONTH_1', ...wexnerFull },
      );
      // longTermTotal is not a declared field on this template, so it is
      // rejected as unknown the moment a client tries to smuggle it in
      // through the responses payload — proving the server never accepts a
      // client-submitted total.
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ responses: { plannedTimepoint: 'MONTH_1', ...wexnerFull, longTermTotal: 999 } })
        .expect(400);
    });
  });

  describe('G. T16 remediation R3 — plannedTimepoint is immutable across amendment (Owner directive)', () => {
    const wexnerFull = {
      longTermSolidStool: 1,
      longTermLiquidStool: 1,
      longTermGas: 0,
      longTermPadWearing: 0,
      longTermLifestyleAlteration: 1,
    };

    async function completeLongTermFollowup(
      plannedTimepoint: string,
      occurredAt: string,
    ) {
      const encounterId = await createEncounter(
        occurredAt,
        `Tái khám ${plannedTimepoint} amendment invariant (dữ liệu giả lập)`,
      );
      const submissionId = await createSubmission(
        encounterId,
        'LONGO_LONG_TERM_FOLLOWUP',
        { plannedTimepoint, ...wexnerFull },
      );
      const completed = await completeSubmission(submissionId);
      return completed.id as string;
    }

    it.each([
      ['MONTH_1', 'MONTH_1', true, '2026-05-01T02:00:00.000Z'],
      ['MONTH_1', 'MONTH_3', false, '2026-05-02T02:00:00.000Z'],
      ['MONTH_3', 'MONTH_3', true, '2026-05-03T02:00:00.000Z'],
      ['MONTH_3', 'MONTH_6', false, '2026-05-04T02:00:00.000Z'],
      ['MONTH_6', 'MONTH_6', true, '2026-05-05T02:00:00.000Z'],
    ])(
      'completed %s amended with plannedTimepoint=%s -> %s',
      async (originalTimepoint, amendedTimepoint, shouldPass, occurredAt) => {
        const submissionId = await completeLongTermFollowup(
          originalTimepoint,
          occurredAt,
        );

        const response = await request(app.getHttpServer())
          .post(`/clinical-forms/${submissionId}/amend`)
          .set('Authorization', `Bearer ${doctorToken}`)
          .send({
            responses: { plannedTimepoint: amendedTimepoint, ...wexnerFull },
            amendmentReason: 'Synthetic amendment invariant check',
          });

        if (shouldPass) {
          expect(response.status).toBe(201);
          expect(response.body.responses.plannedTimepoint).toBe(
            amendedTimepoint,
          );
          expect(response.body.previousSubmissionId).toBe(submissionId);
          expect(response.body.revisionNumber).toBe(2);
        } else {
          expect(response.status).toBe(409);
          const successor = await prisma.clinicalFormSubmission.findFirst({
            where: { previousSubmissionId: submissionId },
          });
          expect(successor).toBeNull();
          const original = await prisma.clinicalFormSubmission.findUniqueOrThrow(
            { where: { id: submissionId } },
          );
          expect(
            (original.responses as Record<string, unknown>).plannedTimepoint,
          ).toBe(originalTimepoint);
        }
      },
    );

    it('never unmatches/rematches a CareTask when the plannedTimepoint-changing amendment is rejected', async () => {
      const submissionId = await completeLongTermFollowup(
        'MONTH_1',
        '2026-05-06T02:00:00.000Z',
      );
      const submission = await prisma.clinicalFormSubmission.findUniqueOrThrow(
        { where: { id: submissionId } },
      );

      const beforeTask = await prisma.careTask.findFirst({
        where: {
          completedByEncounterId: submission.encounterId,
          timepointCode: 'MONTH_1',
        },
      });

      await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/amend`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          responses: { plannedTimepoint: 'MONTH_3', ...wexnerFull },
          amendmentReason: 'Synthetic attempted identity rewrite',
        })
        .expect(409);

      const afterTask = await prisma.careTask.findFirst({
        where: {
          completedByEncounterId: submission.encounterId,
          timepointCode: 'MONTH_1',
        },
      });
      expect(afterTask?.id).toBe(beforeTask?.id);
      expect(afterTask?.status).toBe(beforeTask?.status);
    });
  });
});
