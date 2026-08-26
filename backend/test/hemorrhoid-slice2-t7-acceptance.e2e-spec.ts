import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, CareTaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 2 — T7 TARGETED SYNTHETIC ACCEPTANCE (e2e),
 * DEC-012 OWNER LOCKED, docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md
 * §§22-28.
 *
 * This is not another unit-level regression pass over T1-T6 (those already
 * exist in hemorrhoid-slice2.e2e-spec.ts and hemorrhoid-slice1.e2e-spec.ts).
 * This file runs Contract §23's 17-step golden path as ONE continuous
 * synthetic clinical scenario end-to-end, plus the mandatory negative
 * acceptance cases, so the full workflow sequence is demonstrated together
 * rather than only in isolated fragments.
 *
 * Patient phone/normalizedPhone use obviously-synthetic non-phone-shaped
 * identifiers ('T7-SYNTH-PATIENT-0n') rather than realistic 10-digit VN
 * phone placeholders — this test never asserts on phone format, so no
 * phone-format semantics are required.
 */
describe('Hemorrhoid Vertical Slice 2 — T7 targeted synthetic acceptance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;
  let patientId: string;
  let patient2Id: string;

  async function resetTables() {
    await prisma.auditEvent.deleteMany();
    await prisma.clinicalFormSubmission.deleteMany();
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

  async function createEncounter(
    token: string,
    patient: string,
    reasonForVisit = 'Khám trĩ (synthetic, T7)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient,
        occurredAt: new Date().toISOString(),
        reasonForVisit,
      })
      .expect(201);
    return res.body.id as string;
  }

  async function createSubmission(
    token: string,
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ encounterId, templateKey, responses });
  }

  async function completeSubmission(token: string, id: string) {
    return request(app.getHttpServer())
      .post(`/clinical-forms/${id}/complete`)
      .set('Authorization', `Bearer ${token}`);
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

    const tenant = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice2 T7 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice2-T7-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t7@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    // Step 1 — one synthetic Patient for the golden path.
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid T7 Patient',
        normalizedFullName: 'synthetic hemorrhoid t7 patient',
        dateOfBirth: new Date('1975-05-05'),
        gender: 'MALE',
        phone: 'T7-SYNTH-PATIENT-01',
        normalizedPhone: 'T7-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    // A second synthetic patient, used only for the cross-patient negative case.
    const patient2 = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid T7 Patient Two',
        normalizedFullName: 'synthetic hemorrhoid t7 patient two',
        dateOfBirth: new Date('1980-02-02'),
        gender: 'FEMALE',
        phone: 'T7-SYNTH-PATIENT-02',
        normalizedPhone: 'T7-SYNTH-PATIENT-02',
      },
    });
    patient2Id = patient2.id;

    doctorToken = await login('doctor-t7@gastrocare.test', doctorPassword);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('runs the full Contract §23 golden path (steps 1-17) as one continuous synthetic scenario', async () => {
    // Step 2 — one Hemorrhoid Encounter context.
    const encounterId = await createEncounter(doctorToken, patientId);

    // Step 3 — complete Examination.
    const examCreated = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    expect(examCreated.status).toBe(201);
    const examCompleted = await completeSubmission(
      doctorToken,
      examCreated.body.id,
    );
    expect(examCompleted.status).toBe(201);

    // Step 4 — create/complete Diagnosis.
    const diagnosisCreated = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary: 'Trĩ nội độ II (T7 golden path, synthetic)' },
    );
    expect(diagnosisCreated.status).toBe(201);
    const diagnosisId = diagnosisCreated.body.id as string;
    const diagnosisCompleted = await completeSubmission(doctorToken, diagnosisId);
    expect(diagnosisCompleted.status).toBe(201);

    // Step 5 — create/complete Treatment Decision.
    const decisionCreated = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_TREATMENT_DECISION',
      { decisionSummary: 'Điều trị nội khoa, theo dõi (T7 golden path, synthetic)' },
    );
    expect(decisionCreated.status).toBe(201);
    const decisionCompleted = await completeSubmission(
      doctorToken,
      decisionCreated.body.id,
    );
    expect(decisionCompleted.status).toBe(201);

    // Step 6 — create CarePlan with followUpDate.
    const carePlanCreated = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId,
        instructions: 'Tái khám theo lịch (T7 golden path, synthetic)',
        followUpDate: '2026-10-15',
      });
    expect(carePlanCreated.status).toBe(201);
    const carePlanId = carePlanCreated.body.id as string;

    // Step 7 — sign.
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlanId}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(signed.status).toBe(201);
    const versionId = signed.body.version.id as string;

    // Step 8 — verify exactly one OPEN generic follow-up task.
    const openTasks = await prisma.careTask.findMany({
      where: { carePlanId, status: CareTaskStatus.OPEN, timepointCode: null },
    });
    expect(openTasks).toHaveLength(1);
    const careTaskId = openTasks[0].id;

    // Step 9 — amend with RESCHEDULE + expectedCurrentVersionId.
    const amended = await request(app.getHttpServer())
      .post(`/care-plans/${carePlanId}/amend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        instructions: 'Dời lịch tái khám (T7 golden path, synthetic)',
        followUpDate: '2026-10-22',
        reason: 'Bệnh nhân xin dời lịch (T7 golden path, synthetic)',
        expectedCurrentVersionId: versionId,
        followUpTaskAction: 'RESCHEDULE',
      });
    expect(amended.status).toBe(201);

    // Step 10 — verify version lineage.
    const versions = await prisma.carePlanVersion.findMany({
      where: { carePlanId },
      orderBy: { versionNumber: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0].id).toBe(versionId);
    expect(versions[1].previousVersionId).toBe(versionId);
    const carePlanAfterAmend = await prisma.carePlan.findUniqueOrThrow({
      where: { id: carePlanId },
    });
    expect(carePlanAfterAmend.currentVersionId).toBe(versions[1].id);

    // Step 11 — verify dueDate reflects the RESCHEDULE.
    const rescheduledTask = await prisma.careTask.findUniqueOrThrow({
      where: { id: careTaskId },
    });
    expect(rescheduledTask.status).toBe(CareTaskStatus.OPEN);
    expect(rescheduledTask.dueDate.toISOString().slice(0, 10)).toBe(
      '2026-10-22',
    );

    // Step 12 — create Return Encounter (same patient).
    const returnEncounterId = await createEncounter(
      doctorToken,
      patientId,
      'Tái khám (T7 golden path, synthetic)',
    );

    // Step 13 — explicit task completion via the Return Encounter.
    const completed = await request(app.getHttpServer())
      .post(`/care-tasks/${careTaskId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ completedByEncounterId: returnEncounterId });
    expect(completed.status).toBe(201);

    // Step 14 — verify completedByEncounterId.
    expect(completed.body.completedByEncounterId).toBe(returnEncounterId);
    const completedTask = await prisma.careTask.findUniqueOrThrow({
      where: { id: careTaskId },
    });
    expect(completedTask.status).toBe(CareTaskStatus.COMPLETED);
    expect(completedTask.completedByEncounterId).toBe(returnEncounterId);

    // Step 15 — verify Timeline reflects the full sequence.
    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const timelineEvents = [
      ...timelineRes.body.episodes.flatMap(
        (g: { events: unknown[] }) => g.events,
      ),
      ...timelineRes.body.ungroupedEncounters,
    ] as { type: string; data: Record<string, unknown> }[];

    const diagnosisEvent = timelineEvents.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_DIAGNOSIS' &&
        e.data.encounterId === encounterId,
    );
    expect(diagnosisEvent?.data.summary).toBe(
      'Trĩ nội độ II (T7 golden path, synthetic)',
    );
    const decisionEvent = timelineEvents.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_TREATMENT_DECISION' &&
        e.data.encounterId === encounterId,
    );
    expect(decisionEvent?.data.summary).toBe(
      'Điều trị nội khoa, theo dõi (T7 golden path, synthetic)',
    );
    const taskEvent = timelineEvents.find(
      (e) => e.type === 'CARE_TASK' && e.data.id === careTaskId,
    );
    expect(taskEvent?.data.completedByEncounterId).toBe(returnEncounterId);
    const returnEncounterEvent = timelineEvents.find(
      (e) => e.type === 'ENCOUNTER' && e.data.id === returnEncounterId,
    );
    expect(returnEncounterEvent).toBeTruthy();

    // Step 16 — amend Diagnosis and preserve the original.
    const diagnosisAmended = await request(app.getHttpServer())
      .post(`/clinical-forms/${diagnosisId}/amend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        responses: {
          diagnosisSummary: 'Trĩ nội độ III (đã sửa, T7 golden path, synthetic)',
        },
        amendmentReason: 'Đánh giá lại (T7 golden path, synthetic)',
      });
    expect(diagnosisAmended.status).toBe(201);
    expect(diagnosisAmended.body.revisionNumber).toBe(2);
    expect(diagnosisAmended.body.previousSubmissionId).toBe(diagnosisId);

    const history = await request(app.getHttpServer())
      .get(`/clinical-forms/${diagnosisId}/history`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(history.body.revisions).toHaveLength(2);
    expect(history.body.revisions[0].id).toBe(diagnosisId);
    expect(history.body.revisions[0].responses.diagnosisSummary).toBe(
      'Trĩ nội độ II (T7 golden path, synthetic)',
    );
    expect(history.body.revisions[1].responses.diagnosisSummary).toBe(
      'Trĩ nội độ III (đã sửa, T7 golden path, synthetic)',
    );

    // Step 17 — verify Procedure/Surgery/AI/CORE-05 remain absent (not opened
    // in this Slice). There is no route for any of them; requesting one must
    // 404, never silently succeed or expose deferred scope.
    for (const path of [
      '/procedures',
      '/surgeries',
      '/investigations',
      '/case-intelligence',
    ]) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(404);
    }
  });

  // ==========================================================================
  // Negative acceptance cases — Contract §23.
  // ==========================================================================
  describe('negative acceptance cases', () => {
    it('rejects Diagnosis before Examination', async () => {
      const encounterId = await createEncounter(doctorToken, patientId);
      const res = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'x' },
      );
      expect(res.status).toBe(409);
    });

    it('rejects Treatment Decision before Diagnosis', async () => {
      const encounterId = await createEncounter(doctorToken, patientId);
      const examCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_EXAMINATION',
        {},
      );
      await completeSubmission(doctorToken, examCreated.body.id);
      const res = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'x' },
      );
      expect(res.status).toBe(409);
    });

    it('rejects CarePlan before Treatment Decision', async () => {
      const encounterId = await createEncounter(doctorToken, patientId);
      const examCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_EXAMINATION',
        {},
      );
      await completeSubmission(doctorToken, examCreated.body.id);
      const diagnosisCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'x' },
      );
      await completeSubmission(doctorToken, diagnosisCreated.body.id);
      // Treatment Decision deliberately never completed.
      const res = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ encounterId, instructions: 'x' });
      expect(res.status).toBe(409);
    });

    async function readyForCarePlanEncounter(): Promise<string> {
      const encounterId = await createEncounter(doctorToken, patientId);
      const examCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_EXAMINATION',
        {},
      );
      await completeSubmission(doctorToken, examCreated.body.id);
      const diagnosisCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'x' },
      );
      await completeSubmission(doctorToken, diagnosisCreated.body.id);
      const decisionCreated = await createSubmission(
        doctorToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'x' },
      );
      await completeSubmission(doctorToken, decisionCreated.body.id);
      return encounterId;
    }

    it('rejects a stale expectedCurrentVersionId with 409', async () => {
      const encounterId = await readyForCarePlanEncounter();
      const created = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ encounterId, instructions: 'x', followUpDate: '2026-11-01' });
      expect(created.status).toBe(201);
      const carePlanId = created.body.id as string;
      const signed = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(signed.status).toBe(201);
      const versionId = signed.body.version.id as string;

      const first = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          instructions: 'v2',
          followUpDate: '2026-11-01',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(first.status).toBe(201);

      const stale = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          instructions: 'v3 from stale state',
          followUpDate: '2026-11-01',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(stale.status).toBe(409);
    });

    it('rejects silent drift: a followUpDate change on a signed CarePlan without an explicit followUpTaskAction, when an OPEN task exists, is a 400 — never silently normalized', async () => {
      const encounterId = await readyForCarePlanEncounter();
      const created = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ encounterId, instructions: 'x', followUpDate: '2026-11-05' });
      expect(created.status).toBe(201);
      const carePlanId = created.body.id as string;
      const signed = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(signed.status).toBe(201);
      const versionId = signed.body.version.id as string;

      const drift = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          instructions: 'attempted silent drift',
          followUpDate: '2026-11-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          // followUpTaskAction deliberately omitted.
        });
      expect(drift.status).toBe(400);

      const task = await prisma.careTask.findFirstOrThrow({
        where: { carePlanId },
      });
      expect(task.dueDate.toISOString().slice(0, 10)).toBe('2026-11-05');
    });

    it('rejects cross-patient explicit CareTask completion with 409', async () => {
      const encounterId = await readyForCarePlanEncounter();
      const created = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ encounterId, instructions: 'x', followUpDate: '2026-11-10' });
      expect(created.status).toBe(201);
      const carePlanId = created.body.id as string;
      const signed = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(signed.status).toBe(201);
      const careTaskId = signed.body.careTask.id as string;

      const otherPatientEncounterId = await createEncounter(
        doctorToken,
        patient2Id,
      );
      const res = await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ completedByEncounterId: otherPatientEncounterId });
      expect(res.status).toBe(409);
    });
  });
});
