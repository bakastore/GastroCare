import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-04 T4 — LONGO_PREOP_ASSESSMENT (e2e).
 *
 * This is the first Longo template to exist, so the Longo episode-ancestry
 * invariant built in T2 as structural readiness (backend/src/clinical-forms/
 * templates/longo-episode-invariant.ts) becomes live here for the first
 * time — proves it independently re-verifies ancestry at the Clinical Forms
 * layer, not merely relying on the Encounter-creation-time guard from T1.
 *
 * Synthetic data only.
 */
describe('CORE-04 T4 — LONGO_PREOP_ASSESSMENT (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let patientA1Id: string;
  let patientA2Id: string;
  let patientBId: string;
  let doctorAToken: string;

  const occurredAt = '2026-08-23T08:00:00.000Z';

  async function resetTables() {
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.careTask.deleteMany();
    await prisma.carePlanVersion.deleteMany();
    await prisma.carePlan.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.careEpisode.deleteMany();
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

  beforeAll(async () => {
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

    const tenantA = await prisma.tenant.create({
      data: { name: 'CORE-04 T4 Synthetic Tenant A' },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: 'CORE-04 T4 Synthetic Tenant B' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const doctorAPassword = 'Core04T4-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-a@core04-t4.example.test',
        passwordHash: await bcrypt.hash(doctorAPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantAId,
      },
    });

    const [patientA1, patientA2, patientB] = await Promise.all([
      prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Preop Patient A One',
          normalizedFullName: 'synthetic preop patient a one',
          dateOfBirth: new Date('1980-01-01'),
          gender: 'MALE',
          phone: '0900000501',
          normalizedPhone: '0900000501',
        },
      }),
      prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Preop Patient A Two',
          normalizedFullName: 'synthetic preop patient a two',
          dateOfBirth: new Date('1981-01-01'),
          gender: 'FEMALE',
          phone: '0900000502',
          normalizedPhone: '0900000502',
        },
      }),
      prisma.patient.create({
        data: {
          tenantId: tenantBId,
          fullName: 'Synthetic Preop Patient B',
          normalizedFullName: 'synthetic preop patient b',
          dateOfBirth: new Date('1982-01-01'),
          gender: 'OTHER',
          phone: '0900000503',
          normalizedPhone: '0900000503',
        },
      }),
    ]);
    patientA1Id = patientA1.id;
    patientA2Id = patientA2.id;
    patientBId = patientB.id;

    doctorAToken = await login(
      'doctor-a@core04-t4.example.test',
      doctorAPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  const fullPreopResponses = {
    relevantHistory: 'Tiền sử tổng hợp (dữ liệu giả lập).',
    weightKg: 62,
    heightCm: 165,
    pulseBpm: 78,
    temperatureC: 36.8,
    systolicBloodPressure: 120,
    diastolicBloodPressure: 80,
    anemiaPresent: false,
    rectoscopyPerformed: true,
    rectoscopyImpression: 'Nhận xét tổng hợp (dữ liệu giả lập).',
    preopGoligherGrade: 'II',
    preopHemorrhoidLocation: [3, 7, 11],
  };

  describe('A. Episode ancestry invariant (live for the first time)', () => {
    it('2. an Encounter with episodeId = null is rejected on PREOP create', async () => {
      const encounterRes = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientA1Id,
          occurredAt,
          reasonForVisit: 'Synthetic ungrouped encounter',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: encounterRes.body.id,
          templateKey: 'LONGO_PREOP_ASSESSMENT',
          responses: {},
        })
        .expect(403);
    });

    it('3. an Encounter whose episodeId (bypassing the Encounter-layer guard via direct data manipulation) belongs to a different tenant is independently rejected at the Clinical Forms layer', async () => {
      const episodeB = await prisma.careEpisode.create({
        data: {
          tenantId: tenantBId,
          patientId: patientBId,
          episodeType: 'LONGO_TREATMENT',
          startedAt: new Date(occurredAt),
        },
      });
      // Direct Prisma write bypasses the Encounter-creation-time ancestry
      // guard (T1) on purpose, to prove the Clinical Forms layer (T2/T4)
      // re-verifies ancestry independently rather than trusting it was
      // checked once elsewhere.
      const inconsistentEncounter = await prisma.encounter.create({
        data: {
          tenantId: tenantAId,
          patientId: patientA1Id,
          episodeId: episodeB.id,
          doctorId: 'synthetic-doctor',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
          occurredAt: new Date(occurredAt),
        },
      });

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: inconsistentEncounter.id,
          templateKey: 'LONGO_PREOP_ASSESSMENT',
          responses: {},
        })
        .expect(403);
    });

    it('4. an Encounter whose episodeId belongs to a different patient (same tenant) is independently rejected', async () => {
      const episodeForA2 = await prisma.careEpisode.create({
        data: {
          tenantId: tenantAId,
          patientId: patientA2Id,
          episodeType: 'LONGO_TREATMENT',
          startedAt: new Date(occurredAt),
        },
      });
      const inconsistentEncounter = await prisma.encounter.create({
        data: {
          tenantId: tenantAId,
          patientId: patientA1Id,
          episodeId: episodeForA2.id,
          doctorId: 'synthetic-doctor',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
          occurredAt: new Date(occurredAt),
        },
      });

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: inconsistentEncounter.id,
          templateKey: 'LONGO_PREOP_ASSESSMENT',
          responses: {},
        })
        .expect(403);
    });
  });

  describe('B. Lifecycle with a properly episode-linked Encounter', () => {
    let episodeAId: string;
    let encounterId: string;
    let submissionId: string;

    it('1. Encounter belonging to a same-tenant/same-patient LONGO_TREATMENT Episode: PREOP DRAFT create succeeds', async () => {
      const episodeRes = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientA1Id,
          episodeType: 'LONGO_TREATMENT',
          startedAt: '2026-08-20T02:00:00.000Z',
        })
        .expect(201);
      episodeAId = episodeRes.body.id;

      const encounterRes = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientA1Id,
          episodeId: episodeAId,
          occurredAt,
          reasonForVisit: 'Khám tiền phẫu Longo (dữ liệu giả lập)',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);
      encounterId = encounterRes.body.id;

      const submissionRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId,
          templateKey: 'LONGO_PREOP_ASSESSMENT',
          responses: { weightKg: 60 },
        })
        .expect(201);
      submissionId = submissionRes.body.id;
      expect(submissionRes.body.status).toBe('DRAFT');
      expect(submissionRes.body.templateVersion).toBe(1);
    });

    it('5. a partial DRAFT (only some fields) is accepted', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { weightKg: 61, anemiaPresent: false } })
        .expect(200);
    });

    it('6. completing with a valid (full) response set succeeds', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullPreopResponses })
        .expect(200);

      const completeRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      expect(completeRes.body.status).toBe('COMPLETED');
    });

    it('7. the completed submission is immutable — Gate B still holds for PREOP', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { weightKg: 999 } })
        .expect(409);
    });

    it('8. amending the completed PREOP form succeeds per T2 lineage rules', async () => {
      const amendRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { ...fullPreopResponses, weightKg: 63 },
          amendmentReason: 'Điều chỉnh cân nặng ghi nhận (dữ liệu tổng hợp)',
        })
        .expect(201);
      expect(amendRes.body.revisionNumber).toBe(2);
      expect(amendRes.body.previousSubmissionId).toBe(submissionId);
    });

    it('9. history returns both PREOP revisions in order', async () => {
      const historyRes = await request(app.getHttpServer())
        .get(`/clinical-forms/${submissionId}/history`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(historyRes.body.revisions).toHaveLength(2);
      expect(
        historyRes.body.revisions.map(
          (r: { revisionNumber: number }) => r.revisionNumber,
        ),
      ).toEqual([1, 2]);
    });

    it('10. the original revision is not overwritten by the amendment', async () => {
      const original = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: submissionId },
      });
      expect(original.revisionNumber).toBe(1);
      expect((original.responses as Record<string, unknown>).weightKg).toBe(62);
    });

    it('11. PREOP does not fabricate an instrument score — computedScores has no entries', async () => {
      const completed = await prisma.clinicalFormSubmission.findFirstOrThrow({
        where: { logicalGroupId: submissionId, revisionNumber: 1 },
      });
      expect(completed.computedScores).toEqual({});
    });
  });
});
