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
      expect(res.body.submittedAt).toEqual(expect.any(String));
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
      const formEvents = timelineRes.body.filter(
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
});
