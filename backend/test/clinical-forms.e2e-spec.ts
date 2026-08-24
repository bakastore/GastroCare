import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AuthRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Clinical Forms — real-world clinical form alignment acceptance evidence
 * (see design/REAL_WORLD_FORM_ALIGNMENT.md). Proves the HEMORRHOID_LONGO_FOLLOWUP
 * v1 template end to end: draft/completed lifecycle, server-side response
 * validation, deterministic Wexner score computation, DOCTOR-only RBAC
 * (RECEPTIONIST fully denied per Owner Execution Contract section 38),
 * tenant isolation, historical template-version readability, longitudinal
 * (repeat) submissions, AuditEvent generation, and Timeline integration.
 *
 * Synthetic data only — no real patient data.
 */
describe('Clinical Forms — HEMORRHOID_LONGO_FOLLOWUP (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };

  const doctorAPassword = 'ClinicalFormsDoctorA-Pass1!';
  const receptionistAPassword = 'ClinicalFormsReceptionA-Pass1!';
  const doctorBPassword = 'ClinicalFormsDoctorB-Pass1!';

  let doctorAToken: string;
  let receptionistAToken: string;
  let doctorBToken: string;

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

    tenantA = await prisma.tenant.create({
      data: { name: 'Clinical Forms Test Tenant A' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'Clinical Forms Test Tenant B' },
    });

    await prisma.authUser.create({
      data: {
        email: 'doctor-a@clinical-forms-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorAPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'receptionist-a@clinical-forms-test.gastrocare.local',
        passwordHash: await bcrypt.hash(receptionistAPassword, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'doctor-b@clinical-forms-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorBPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantB.id,
      },
    });

    doctorAToken = await loginAs(
      'doctor-a@clinical-forms-test.gastrocare.local',
      doctorAPassword,
    );
    receptionistAToken = await loginAs(
      'receptionist-a@clinical-forms-test.gastrocare.local',
      receptionistAPassword,
    );
    doctorBToken = await loginAs(
      'doctor-b@clinical-forms-test.gastrocare.local',
      doctorBPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createPatientAndEncounter(
    token: string,
    fullName: string,
    phone: string,
  ): Promise<{ patientId: string; encounterId: string }> {
    const patientRes = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName,
        dateOfBirth: '1975-01-01',
        gender: 'MALE',
        phone,
      })
      .expect(201);
    const patientId = patientRes.body.patient.id as string;

    const encounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        occurredAt: '2026-08-01T09:00:00.000Z',
        reasonForVisit: 'Khám lại sau phẫu thuật Longo',
        clinicalNote: 'Bệnh nhân tỉnh, tiếp xúc tốt',
        assessment: 'Theo dõi sau mổ trĩ Longo',
      })
      .expect(201);

    return { patientId, encounterId: encounterRes.body.id as string };
  }

  const wexnerAllNever = {
    wexnerSolidStool: 0,
    wexnerLiquidStool: 0,
    wexnerGas: 0,
    wexnerPadWearing: 0,
    wexnerLifestyleAlteration: 0,
  };

  describe('A. Lifecycle, validation, deterministic scoring', () => {
    let encounterId: string;
    let submissionId: string;

    it('doctor creates a DRAFT submission (partial responses allowed)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient Longo A',
        '0911000001',
      );
      encounterId = created.encounterId;

      const res = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(201);

      submissionId = res.body.id;
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.templateVersion).toBe(1);
      expect(res.body.computedScores).toBeNull();
    });

    it('rejects an out-of-range value (VAS must be 0-10)', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { visitNumber: 1, vasPain: 55 } })
        .expect(400);
    });

    it('rejects an unknown field key', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { notARealField: 1 } })
        .expect(400);
    });

    it('doctor updates the DRAFT with a full valid response set', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: {
            visitNumber: 1,
            monthsPostOp: 1,
            vasPain: 2,
            ...wexnerAllNever,
            additionalNotes: 'Diễn biến ổn định (dữ liệu tổng hợp).',
          },
        })
        .expect(200);
      expect(res.body.status).toBe('DRAFT');
    });

    it('completing computes the Wexner total deterministically (0 for all-Never)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.computedScores).toEqual({ wexner: 0 });
      expect(res.body.completedAt).toEqual(expect.any(String));
      expect(res.body.completedByUserId).toEqual(expect.any(String));
      expect(res.body.revisionNumber).toBe(1);
      expect(res.body.logicalGroupId).toBe(submissionId);
    });

    it('a COMPLETED submission can no longer be edited (409)', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${submissionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { visitNumber: 2 } })
        .expect(409);
    });

    it('completing again is rejected (409)', async () => {
      await request(app.getHttpServer())
        .post(`/clinical-forms/${submissionId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);
    });

    it('a second submission for the same template on the same Encounter is rejected (409)', async () => {
      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(409);
    });

    it('Wexner total sums non-zero item responses correctly', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient Longo B',
        '0911000002',
      );
      const createRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: created.encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: {
            visitNumber: 1,
            monthsPostOp: 1,
            vasPain: 3,
            wexnerSolidStool: 1,
            wexnerLiquidStool: 2,
            wexnerGas: 3,
            wexnerPadWearing: 0,
            wexnerLifestyleAlteration: 4,
          },
        })
        .expect(201);

      const completeRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${createRes.body.id}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);

      expect(completeRes.body.computedScores).toEqual({ wexner: 10 });
    });
  });

  describe('B. RBAC — RECEPTIONIST fully denied', () => {
    let encounterId: string;

    beforeAll(async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient Longo RBAC',
        '0911000003',
      );
      encounterId = created.encounterId;
    });

    it('receptionist cannot create a submission (403)', async () => {
      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({
          encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(403);
    });

    it('receptionist cannot list clinical forms for a patient (403)', async () => {
      await request(app.getHttpServer())
        .get(`/clinical-forms?patientId=irrelevant`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('receptionist cannot read a specific submission (403), even one that exists', async () => {
      const doctorCreate = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/clinical-forms/${doctorCreate.body.id}`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });
  });

  describe('C. Tenant isolation — cross-tenant mutation attempts', () => {
    let tenantAEncounterId: string;
    let tenantASubmissionId: string;

    beforeAll(async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient Longo Tenant',
        '0911000004',
      );
      tenantAEncounterId = created.encounterId;

      const submissionRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: tenantAEncounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(201);
      tenantASubmissionId = submissionRes.body.id;
    });

    it('tenant B cannot create a submission against tenant A Encounter (404, not 403 — existence not leaked)', async () => {
      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          encounterId: tenantAEncounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(404);
    });

    it('tenant B cannot read tenant A submission (404)', async () => {
      await request(app.getHttpServer())
        .get(`/clinical-forms/${tenantASubmissionId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('tenant B cannot update tenant A draft (404)', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${tenantASubmissionId}/draft`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ responses: { visitNumber: 9 } })
        .expect(404);
    });

    it('tenant B cannot complete tenant A draft (404)', async () => {
      await request(app.getHttpServer())
        .post(`/clinical-forms/${tenantASubmissionId}/complete`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('database state confirms nothing changed after the cross-tenant attempts', async () => {
      const stillDraft = await prisma.clinicalFormSubmission.findUnique({
        where: { id: tenantASubmissionId },
      });
      expect(stillDraft?.status).toBe('DRAFT');
      expect(
        (stillDraft?.responses as { visitNumber: number }).visitNumber,
      ).toBe(1);
    });
  });

  describe('D. Longitudinal submissions + Timeline integration', () => {
    it('multiple follow-up encounters for the same patient each get their own submission (longitudinal history)', async () => {
      const patientRes = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Synthetic Patient Longo Longitudinal',
          dateOfBirth: '1980-01-01',
          gender: 'FEMALE',
          phone: '0911000005',
        })
        .expect(201);
      const patientId = patientRes.body.patient.id;

      const submissionIds: string[] = [];
      for (const visitNumber of [1, 2]) {
        const encounterRes = await request(app.getHttpServer())
          .post('/encounters')
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({
            patientId,
            occurredAt: `2026-08-${String(visitNumber).padStart(2, '0')}T09:00:00.000Z`,
            reasonForVisit: `Khám lại lần ${visitNumber}`,
            clinicalNote: 'Ghi chú tổng hợp',
            assessment: 'Theo dõi định kỳ',
          })
          .expect(201);

        const submissionRes = await request(app.getHttpServer())
          .post('/clinical-forms')
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({
            encounterId: encounterRes.body.id,
            templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
            responses: {
              visitNumber,
              monthsPostOp: visitNumber,
              vasPain: 1,
              ...wexnerAllNever,
            },
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/clinical-forms/${submissionRes.body.id}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .expect(201);

        submissionIds.push(submissionRes.body.id as string);
      }

      const listRes = await request(app.getHttpServer())
        .get(`/clinical-forms?patientId=${patientId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(listRes.body).toHaveLength(2);
      expect(listRes.body.map((s: { id: string }) => s.id).sort()).toEqual(
        submissionIds.sort(),
      );

      const timelineRes = await request(app.getHttpServer())
        .get(`/patients/${patientId}/timeline`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      // These Encounters predate CORE-04 Episodes, so their events land
      // under ungroupedEncounters (T11).
      const formEvents = timelineRes.body.ungroupedEncounters.filter(
        (e: { type: string }) => e.type === 'CLINICAL_FORM_SUBMITTED',
      );
      expect(formEvents).toHaveLength(2);
      expect(formEvents[0].data.computedScores).toEqual({ wexner: 0 });
    });
  });

  describe('E. Historical template-version readability + Audit', () => {
    it('a completed submission still resolves against its own stored templateVersion after read', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient Longo Version',
        '0911000006',
      );
      const createRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: created.encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: {
            visitNumber: 1,
            monthsPostOp: 1,
            vasPain: 0,
            ...wexnerAllNever,
          },
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/clinical-forms/${createRes.body.id}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);

      const readBack = await request(app.getHttpServer())
        .get(`/clinical-forms/${createRes.body.id}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(readBack.body.templateVersion).toBe(1);
      expect(readBack.body.computedScores).toEqual({ wexner: 0 });
    });

    it('AuditEvent rows exist for creation and completion, without raw responses in metadata', async () => {
      const events = await prisma.auditEvent.findMany({
        where: {
          tenantId: tenantA.id,
          entityType: 'ClinicalFormSubmission',
          action: { in: ['CLINICAL_FORM_CREATED', 'CLINICAL_FORM_COMPLETED'] },
        },
      });
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const serialized = JSON.stringify(event.metadata ?? {});
        expect(serialized).not.toContain('wexnerSolidStool');
        expect(serialized).not.toContain('vasPain');
        expect(serialized).not.toContain('additionalNotes');
      }
    });
  });

  // ---------------------------------------------------------------------
  // F. CORE-04 T2 — Amendment Lineage (Gate B)
  // ---------------------------------------------------------------------
  describe('F. T2 — Amendment Lineage', () => {
    const fullResponses = {
      visitNumber: 1,
      monthsPostOp: 1,
      vasPain: 2,
      ...wexnerAllNever,
    };

    async function createAndCompleteSubmission(
      token: string,
      encounterId: string,
      responses: Record<string, number | string> = fullResponses,
    ): Promise<string> {
      const createRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/clinical-forms/${createRes.body.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      return createRes.body.id as string;
    }

    it('amend on a DRAFT submission is rejected (409) — only COMPLETED can be amended', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Draft',
        '0912000001',
      );
      const createRes = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: created.encounterId,
          templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
          responses: { visitNumber: 1 },
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/clinical-forms/${createRes.body.id}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses, amendmentReason: 'test' })
        .expect(409);
    });

    it('amend on the COMPLETED head succeeds, creates revision 2 with correct lineage, and never changes the original row', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Success',
        '0912000002',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      const originalBefore = await request(app.getHttpServer())
        .get(`/clinical-forms/${originalId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      const correctedResponses = { ...fullResponses, vasPain: 7 };
      const amendRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: correctedResponses,
          amendmentReason: 'Sửa lại điểm đau (dữ liệu tổng hợp)',
        })
        .expect(201);

      expect(amendRes.body.id).not.toBe(originalId);
      expect(amendRes.body.status).toBe('COMPLETED');
      expect(amendRes.body.revisionNumber).toBe(2);
      expect(amendRes.body.previousSubmissionId).toBe(originalId);
      expect(amendRes.body.logicalGroupId).toBe(
        originalBefore.body.logicalGroupId,
      );
      expect(amendRes.body.responses).toEqual(correctedResponses);
      // computedScores is recomputed from the corrected responses, not
      // copied from the original.
      expect(amendRes.body.computedScores).toEqual({ wexner: 0 });
      expect(amendRes.body.amendmentReason).toBe(
        'Sửa lại điểm đau (dữ liệu tổng hợp)',
      );
      expect(amendRes.body.amendedByUserId).toEqual(expect.any(String));
      expect(amendRes.body.completedByUserId).toEqual(expect.any(String));

      const originalAfter = await request(app.getHttpServer())
        .get(`/clinical-forms/${originalId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(originalAfter.body).toEqual(originalBefore.body);
    });

    it('amending an already-superseded (non-head) revision is rejected (409)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Superseded',
        '0912000003',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses, amendmentReason: 'first amendment' })
        .expect(201);

      // originalId is now superseded — amending it again must be rejected.
      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: fullResponses,
          amendmentReason: 'second attempt on stale head',
        })
        .expect(409);
    });

    it('amend missing amendmentReason is rejected (400)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend No Reason',
        '0912000004',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses })
        .expect(400);
    });

    it('amend with an empty/whitespace-only amendmentReason is rejected (400)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Blank Reason',
        '0912000005',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses, amendmentReason: '   ' })
        .expect(400);
    });

    it('amend with a partial (incomplete) response snapshot is rejected — full corrected snapshot required', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Partial',
        '0912000006',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { visitNumber: 1 },
          amendmentReason: 'partial only',
        })
        .expect(400);
    });

    it('receptionist cannot amend (403)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend RBAC',
        '0912000007',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({ responses: fullResponses, amendmentReason: 'x' })
        .expect(403);
    });

    it('cross-tenant amend is rejected (404, not 403 — existence not leaked)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Cross Tenant',
        '0912000008',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          responses: fullResponses,
          amendmentReason: 'cross tenant attempt',
        })
        .expect(404);

      const stillOriginal = await prisma.clinicalFormSubmission.findUnique({
        where: { id: originalId },
      });
      expect(stillOriginal?.revisionNumber).toBe(1);
    });

    it('database rejects a duplicate chain root for the same (Encounter, templateKey), bypassing the application layer', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 DB Duplicate Root',
        '0912000009',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );
      const original = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: originalId },
      });

      await expect(
        prisma.clinicalFormSubmission.create({
          data: {
            tenantId: original.tenantId,
            patientId: original.patientId,
            encounterId: original.encounterId,
            templateKey: original.templateKey,
            templateVersion: original.templateVersion,
            status: 'DRAFT',
            responses: {},
            actorId: original.actorId,
            logicalGroupId: 'db-duplicate-root-test',
            revisionNumber: 1,
          },
        }),
      ).rejects.toThrow();
    });

    it('database rejects two revisions forking from the same previousSubmissionId, bypassing the application layer', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 DB Fork',
        '0912000010',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );
      const original = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: originalId },
      });

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses, amendmentReason: 'first amendment' })
        .expect(201);

      await expect(
        prisma.clinicalFormSubmission.create({
          data: {
            tenantId: original.tenantId,
            patientId: original.patientId,
            encounterId: original.encounterId,
            templateKey: original.templateKey,
            templateVersion: original.templateVersion,
            status: 'COMPLETED',
            responses: fullResponses,
            actorId: original.actorId,
            logicalGroupId: original.logicalGroupId,
            revisionNumber: 3,
            previousSubmissionId: originalId,
            amendmentReason: 'fork attempt',
            amendedByUserId: original.actorId,
            completedByUserId: original.actorId,
            completedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    });

    it('history returns >= 3 revisions in correct order with the correct current head, and preserves every historical revision', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 History',
        '0912000011',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      const amend1 = await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { ...fullResponses, vasPain: 5 },
          amendmentReason: 'first correction',
        })
        .expect(201);

      const amend2 = await request(app.getHttpServer())
        .post(`/clinical-forms/${amend1.body.id}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { ...fullResponses, vasPain: 8 },
          amendmentReason: 'second correction',
        })
        .expect(201);

      const historyRes = await request(app.getHttpServer())
        .get(`/clinical-forms/${originalId}/history`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(historyRes.body.revisions).toHaveLength(3);
      expect(
        historyRes.body.revisions.map(
          (r: { revisionNumber: number }) => r.revisionNumber,
        ),
      ).toEqual([1, 2, 3]);
      expect(historyRes.body.revisions[0].id).toBe(originalId);
      expect(historyRes.body.revisions[1].id).toBe(amend1.body.id);
      expect(historyRes.body.revisions[2].id).toBe(amend2.body.id);
      expect(historyRes.body.current.id).toBe(amend2.body.id);

      // Fetching history from any revision in the chain (not just the
      // original) returns the same complete, ordered chain.
      const historyFromMiddle = await request(app.getHttpServer())
        .get(`/clinical-forms/${amend1.body.id}/history`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(historyFromMiddle.body.revisions).toHaveLength(3);
      expect(historyFromMiddle.body.current.id).toBe(amend2.body.id);
    });

    it('cross-tenant history read is rejected (404)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 History Cross Tenant',
        '0912000012',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .get(`/clinical-forms/${originalId}/history`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('receptionist cannot read history (403)', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 History RBAC',
        '0912000013',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .get(`/clinical-forms/${originalId}/history`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('Longo episode ancestry invariant is a no-op for non-Longo templates (HEMORRHOID_LONGO_FOLLOWUP) — create/complete/amend all succeed without any CareEpisode', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Non-Longo Episode Noop',
        '0912000014',
      );
      const encounter = await prisma.encounter.findUniqueOrThrow({
        where: { id: created.encounterId },
      });
      expect(encounter.episodeId).toBeNull();

      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: fullResponses,
          amendmentReason: 'still no episode required',
        })
        .expect(201);
    });

    it('AuditEvent for amendment carries only identifiers, never response content or the raw amendment reason', async () => {
      const created = await createPatientAndEncounter(
        doctorAToken,
        'Synthetic Patient T2 Amend Audit',
        '0912000015',
      );
      const originalId = await createAndCompleteSubmission(
        doctorAToken,
        created.encounterId,
      );

      const sensitiveReason = 'Bệnh nhân báo đau dữ dội hơn ghi nhận ban đầu';
      const amendRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: fullResponses, amendmentReason: sensitiveReason })
        .expect(201);

      const events = await prisma.auditEvent.findMany({
        where: {
          tenantId: tenantA.id,
          entityType: 'ClinicalFormSubmission',
          entityId: amendRes.body.id,
          action: 'CLINICAL_FORM_AMENDED',
        },
      });
      expect(events).toHaveLength(1);
      const metadata = events[0].metadata as Record<string, unknown>;
      expect(metadata.previousSubmissionId).toBe(originalId);
      expect(metadata.newSubmissionId).toBe(amendRes.body.id);
      expect(metadata.revisionNumber).toBe(2);
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain(sensitiveReason);
      expect(serialized).not.toContain('vasPain');
    });
  });
});
