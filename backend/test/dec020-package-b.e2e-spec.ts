import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DEC-020 Package B (e2e) — Clinical Form Fidelity + Functional Clinical UX.
 *
 * Focused HTTP coverage for the genuinely NEW behaviour Package B adds on
 * top of the existing HEMORRHOID_EXAMINATION infrastructure:
 *
 *  - a brand-new examination is created against templateVersion 2;
 *  - v2 optionality: a blank v2 examination still goes DRAFT -> COMPLETED;
 *  - deterministic vital copy-forward now carries respiratoryRate + spo2;
 *  - a stored v1 examination stays readable and amendable under version 1;
 *  - completing an examination never mutates Diagnosis/Treatment.
 *
 * Synthetic data only.
 */
describe('DEC-020 Package B (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantId: string;
  let patientId: string;
  let doctorId: string;
  let doctorToken: string;

  async function resetTables() {
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

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function createInitialEncounter(occurredAt: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set(auth(doctorToken))
      .send({
        patientId,
        responsibleClinicianId: doctorId,
        occurredAt,
        reasonForVisit: 'Khám trĩ (synthetic Package B)',
        workflowKind: 'HEMORRHOID_INITIAL',
      })
      .expect(201);
    return res.body.id as string;
  }

  async function createExam(encounterId: string, responses: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/clinical-forms')
      .set(auth(doctorToken))
      .send({ encounterId, templateKey: 'HEMORRHOID_EXAMINATION', responses })
      .expect(201);
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
      data: { name: 'DEC-020 Package B Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctor = await prisma.authUser.create({
      data: {
        tenantId,
        email: 'doctor@dec020-package-b.example.test',
        passwordHash: await bcrypt.hash('PackageB-Doctor-Pass1!', 10),
        role: 'DOCTOR',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    doctorId = doctor.id;

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Package B Patient',
        normalizedFullName: 'synthetic package b patient',
        dateOfBirth: new Date('1980-01-01'),
        gender: 'MALE',
        phone: '0900000700',
        normalizedPhone: '0900000700',
      },
    });
    patientId = patient.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: doctor.email, password: 'PackageB-Doctor-Pass1!' })
      .expect(200);
    doctorToken = login.body.accessToken;
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('a new HEMORRHOID_EXAMINATION is created against templateVersion 2', async () => {
    const encounterId = await createInitialEncounter('2026-09-01T02:00:00.000Z');
    const created = await createExam(encounterId, {});
    expect(created.body.templateVersion).toBe(2);
    expect(created.body.status).toBe('DRAFT');
  });

  it('a blank v2 examination goes DRAFT -> COMPLETED (optional-by-default, T2)', async () => {
    const encounterId = await createInitialEncounter('2026-09-02T02:00:00.000Z');
    const created = await createExam(encounterId, {});
    const completed = await request(app.getHttpServer())
      .post(`/clinical-forms/${created.body.id}/complete`)
      .set(auth(doctorToken))
      .expect(201);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.templateVersion).toBe(2);
  });

  it('v2 rejects a fabricated per-lesion / unknown field', async () => {
    const encounterId = await createInitialEncounter('2026-09-03T02:00:00.000Z');
    await request(app.getHttpServer())
      .post('/clinical-forms')
      .set(auth(doctorToken))
      .send({
        encounterId,
        templateKey: 'HEMORRHOID_EXAMINATION',
        responses: { pileNumber1Grade: 'II' },
      })
      .expect(400);
  });

  it('deterministic vital copy-forward carries respiratoryRate + spo2 from a v2 source', async () => {
    const sourceEncounter = await createInitialEncounter('2026-09-10T02:00:00.000Z');
    const sourceExam = await createExam(sourceEncounter, {
      pulse: 80,
      respiratoryRate: 18,
      spo2: 97,
      systolicBloodPressure: 120,
      diastolicBloodPressure: 80,
    });
    await request(app.getHttpServer())
      .post(`/clinical-forms/${sourceExam.body.id}/complete`)
      .set(auth(doctorToken))
      .expect(201);

    const targetEncounter = await createInitialEncounter('2026-09-20T02:00:00.000Z');
    const cf = await request(app.getHttpServer())
      .get(`/clinical-forms/vitals-copy-forward?targetEncounterId=${targetEncounter}`)
      .set(auth(doctorToken))
      .expect(200);
    expect(cf.body.sourceSubmissionId).toBe(sourceExam.body.id);
    expect(cf.body.vitals).toMatchObject({
      pulse: 80,
      respiratoryRate: 18,
      spo2: 97,
      systolicBloodPressure: 120,
      diastolicBloodPressure: 80,
    });
  });

  it('a stored v1 examination stays readable and amendable under templateVersion 1', async () => {
    const encounterId = await createInitialEncounter('2026-08-15T02:00:00.000Z');
    // Insert a v1 submission directly (the historical shape) and complete it
    // through the normal endpoint.
    const v1 = await prisma.clinicalFormSubmission.create({
      data: {
        tenantId,
        patientId,
        encounterId,
        templateKey: 'HEMORRHOID_EXAMINATION',
        templateVersion: 1,
        status: 'DRAFT',
        responses: { hemorrhoidGoligherGrade: 'II', prolapseSymptom: true },
        actorId: doctorId,
        logicalGroupId: '',
        revisionNumber: 1,
      },
    });
    await prisma.clinicalFormSubmission.update({
      where: { id: v1.id },
      data: { logicalGroupId: v1.id },
    });

    await request(app.getHttpServer())
      .post(`/clinical-forms/${v1.id}/complete`)
      .set(auth(doctorToken))
      .expect(201);

    const read = await request(app.getHttpServer())
      .get(`/clinical-forms/${v1.id}`)
      .set(auth(doctorToken))
      .expect(200);
    expect(read.body.templateVersion).toBe(1);

    const amended = await request(app.getHttpServer())
      .post(`/clinical-forms/${v1.id}/amend`)
      .set(auth(doctorToken))
      .send({
        responses: { hemorrhoidGoligherGrade: 'III', prolapseSymptom: true },
        amendmentReason: 'Correct grade',
      })
      .expect(201);
    expect(amended.body.templateVersion).toBe(1);
    expect(amended.body.revisionNumber).toBe(2);
  });

  it('completing an examination does not create or mutate a Diagnosis/Treatment submission', async () => {
    const encounterId = await createInitialEncounter('2026-09-25T02:00:00.000Z');
    const created = await createExam(encounterId, { symptomAnalPain: true });
    await request(app.getHttpServer())
      .post(`/clinical-forms/${created.body.id}/complete`)
      .set(auth(doctorToken))
      .expect(201);

    const all = await request(app.getHttpServer())
      .get(`/clinical-forms?patientId=${patientId}`)
      .set(auth(doctorToken))
      .expect(200);
    const forThisEncounter = all.body.filter(
      (s: { encounterId: string }) => s.encounterId === encounterId,
    );
    expect(forThisEncounter).toHaveLength(1);
    expect(forThisEncounter[0].templateKey).toBe('HEMORRHOID_EXAMINATION');
  });
});
