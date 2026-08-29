import { decisionFixture } from './dec016-fixtures';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, ClinicalFormStatus, CareTaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';

/**
 * Hemorrhoid Vertical Slice 2 — T1-T4 (e2e), DEC-012 OWNER LOCKED,
 * docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md.
 *
 * T1 HEMORRHOID_DIAGNOSIS, T2 HEMORRHOID_TREATMENT_DECISION, T3 CarePlan
 * sequence enforcement, T4 CarePlan/CareTask reconciliation + concurrency
 * (C1-C4 against real PostgreSQL SERIALIZABLE transactions). Synthetic data
 * only.
 */
describe('Hemorrhoid Vertical Slice 2 — T1-T4 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auditService: AuditService;

  let tenantAId: string;
  let tenantBId: string;
  let patientAId: string;

  let doctorAToken: string;
  let doctorBToken: string;

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
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function createEncounter(
    token: string,
    patientId: string,
    reasonForVisit = 'Khám trĩ (synthetic)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workflowKind: 'HEMORRHOID_INITIAL',
        patientId,
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
      .send({ encounterId, templateKey, responses: decisionFixture(templateKey, responses) });
  }

  async function completeSubmission(token: string, id: string) {
    return request(app.getHttpServer())
      .post(`/clinical-forms/${id}/complete`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function completeExamination(
    token: string,
    encounterId: string,
  ): Promise<string> {
    const created = await createSubmission(
      token,
      encounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    ).then((r) => {
      expect(r.status).toBe(201);
      return r;
    });
    const id = created.body.id as string;
    await completeSubmission(token, id).then((r) => expect(r.status).toBe(201));
    return id;
  }

  async function completeDiagnosis(
    token: string,
    encounterId: string,
    diagnosisSummary = 'Trĩ nội độ II (synthetic)',
  ): Promise<string> {
    const created = await createSubmission(
      token,
      encounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary },
    );
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const completed = await completeSubmission(token, id);
    expect(completed.status).toBe(201);
    return id;
  }

  async function completeTreatmentDecision(
    token: string,
    encounterId: string,
    decisionSummary = 'Điều trị nội khoa, theo dõi (synthetic)',
  ): Promise<string> {
    const created = await createSubmission(
      token,
      encounterId,
      'HEMORRHOID_TREATMENT_DECISION',
      { decisionSummary },
    );
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const completed = await completeSubmission(token, id);
    expect(completed.status).toBe(201);
    return id;
  }

  /** Full golden path up to a completed Treatment Decision on a fresh Encounter. */
  async function readyForCarePlanEncounter(token: string): Promise<string> {
    const encounterId = await createEncounter(token, patientAId);
    await completeExamination(token, encounterId);
    await completeDiagnosis(token, encounterId);
    await completeTreatmentDecision(token, encounterId);
    return encounterId;
  }

  async function createCarePlan(
    token: string,
    encounterId: string,
    instructions: string,
    followUpDate?: string,
  ) {
    return request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ encounterId, instructions, followUpDate });
  }

  async function signCarePlan(token: string, carePlanId: string) {
    return request(app.getHttpServer())
      .post(`/care-plans/${carePlanId}/sign`)
      .set('Authorization', `Bearer ${token}`);
  }

  /** Creates + signs a CarePlan on a ready Hemorrhoid Encounter. Returns ids. */
  async function signedHemorrhoidCarePlan(
    token: string,
    followUpDate?: string,
  ): Promise<{ carePlanId: string; versionId: string; careTaskId: string | null }> {
    const encounterId = await readyForCarePlanEncounter(token);
    const created = await createCarePlan(
      token,
      encounterId,
      'Điều trị theo đơn (synthetic)',
      followUpDate,
    );
    expect(created.status).toBe(201);
    const carePlanId = created.body.id as string;
    const signed = await signCarePlan(token, carePlanId);
    expect(signed.status).toBe(201);
    return {
      carePlanId,
      versionId: signed.body.version.id as string,
      careTaskId: (signed.body.careTask?.id as string) ?? null,
    };
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
    auditService = app.get(AuditService);
    await resetTables();

    const tenantA = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice2 Synthetic Tenant A' },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice2 Synthetic Tenant B' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const doctorAPassword = 'Slice2-DoctorA-Pass1!';
    const doctorBPassword = 'Slice2-DoctorB-Pass1!';

    await prisma.authUser.create({
      data: {
        email: 'doctor-a@hemorrhoid-slice2.example.test',
        passwordHash: await bcrypt.hash(doctorAPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantAId,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'doctor-b@hemorrhoid-slice2.example.test',
        passwordHash: await bcrypt.hash(doctorBPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantBId,
      },
    });

    const patientA = await prisma.patient.create({
      data: {
        tenantId: tenantAId,
        fullName: 'Synthetic Hemorrhoid Slice2 Patient A',
        normalizedFullName: 'synthetic hemorrhoid slice2 patient a',
        dateOfBirth: new Date('1979-01-01'),
        gender: 'MALE',
        phone: '0900000701',
        normalizedPhone: '0900000701',
      },
    });
    patientAId = patientA.id;

    doctorAToken = await login(
      'doctor-a@hemorrhoid-slice2.example.test',
      doctorAPassword,
    );
    doctorBToken = await login(
      'doctor-b@hemorrhoid-slice2.example.test',
      doctorBPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  // ==========================================================================
  // T1 — HEMORRHOID_DIAGNOSIS
  // ==========================================================================
  describe('T1 — HEMORRHOID_DIAGNOSIS', () => {
    it('rejects Diagnosis creation before the Encounter has a COMPLETED HEMORRHOID_EXAMINATION', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      const res = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'x' },
      );
      expect(res.status).toBe(409);
    });

    it('direct API bypass also fails when Examination exists but is still DRAFT', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      const draftExam = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_EXAMINATION',
        {},
      );
      expect(draftExam.status).toBe(201);
      // Deliberately never completed.
      const res = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'x' },
      );
      expect(res.status).toBe(409);
    });

    it('valid create + complete succeeds once Examination is COMPLETED', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);

      const created = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'Trĩ nội độ II (synthetic)' },
      );
      expect(created.status).toBe(201);
      expect(created.body.status).toBe(ClinicalFormStatus.DRAFT);

      const completed = await completeSubmission(doctorAToken, created.body.id);
      expect(completed.status).toBe(201);
      expect(completed.body.status).toBe(ClinicalFormStatus.COMPLETED);
    });

    it('diagnosisSummary is required at completion time', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);

      const created = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        {},
      );
      expect(created.status).toBe(201);

      const completed = await completeSubmission(doctorAToken, created.body.id);
      expect(completed.status).toBe(400);
    });

    it('exactly one logical HEMORRHOID_DIAGNOSIS root chain per Encounter', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);

      const second = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'attempted second root' },
      );
      expect(second.status).toBe(409);
    });

    it('amendment works and the original COMPLETED revision remains immutable', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      const diagnosisId = await completeDiagnosis(doctorAToken, encounterId);

      // Original immutable: draft-edit and re-complete both rejected.
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${diagnosisId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { diagnosisSummary: 'attempted overwrite' } })
        .expect(409);
      await completeSubmission(doctorAToken, diagnosisId).then((r) =>
        expect(r.status).toBe(409),
      );

      const amended = await request(app.getHttpServer())
        .post(`/clinical-forms/${diagnosisId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { diagnosisSummary: 'Trĩ nội độ III (đã sửa, synthetic)' },
          amendmentReason: 'Đánh giá lại sau tái khám (synthetic)',
        })
        .expect(201);
      expect(amended.body.revisionNumber).toBe(2);
      expect(amended.body.previousSubmissionId).toBe(diagnosisId);

      const history = await request(app.getHttpServer())
        .get(`/clinical-forms/${diagnosisId}/history`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(history.body.revisions).toHaveLength(2);
      expect(history.body.revisions[0].responses.diagnosisSummary).toBe(
        'Trĩ nội độ II (synthetic)',
      );
    });

    it('tenant isolation: Tenant B cannot create a Diagnosis against a Tenant A Encounter', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);

      const res = await createSubmission(
        doctorBToken,
        encounterId,
        'HEMORRHOID_DIAGNOSIS',
        { diagnosisSummary: 'cross-tenant attempt' },
      );
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // T2 — HEMORRHOID_TREATMENT_DECISION
  // ==========================================================================
  describe('T2 — HEMORRHOID_TREATMENT_DECISION', () => {
    it('rejects Treatment Decision creation before the Encounter has a COMPLETED HEMORRHOID_DIAGNOSIS', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      // Diagnosis deliberately never created.
      const res = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'x' },
      );
      expect(res.status).toBe(409);
    });

    it('valid create + complete succeeds once Diagnosis is COMPLETED', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);

      const created = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'Điều trị nội khoa (synthetic)' },
      );
      expect(created.status).toBe(201);
      const completed = await completeSubmission(doctorAToken, created.body.id);
      expect(completed.status).toBe(201);
      expect(completed.body.status).toBe(ClinicalFormStatus.COMPLETED);
    });

    it('decisionSummary is required at completion time', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);

      const created = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        {},
      );
      expect(created.status).toBe(201);
      const completed = await completeSubmission(doctorAToken, created.body.id);
      expect(completed.status).toBe(400);
    });

    it('exactly one logical HEMORRHOID_TREATMENT_DECISION root chain per Encounter', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);
      await completeTreatmentDecision(doctorAToken, encounterId);

      const second = await createSubmission(
        doctorAToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'attempted second root' },
      );
      expect(second.status).toBe(409);
    });

    it('amendment works and the original COMPLETED revision remains immutable', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);
      const decisionId = await completeTreatmentDecision(doctorAToken, encounterId);

      await request(app.getHttpServer())
        .patch(`/clinical-forms/${decisionId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ responses: { decisionSummary: 'attempted overwrite' } })
        .expect(409);

      const amended = await request(app.getHttpServer())
        .post(`/clinical-forms/${decisionId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { decisionSummary: 'Điều trị ngoại khoa (đã sửa, synthetic)', treatmentModalities: ['SURGERY'] },
          amendmentReason: 'Thay đổi hướng điều trị (synthetic)',
        })
        .expect(201);
      expect(amended.body.revisionNumber).toBe(2);
    });

    it('tenant isolation: Tenant B cannot create a Treatment Decision against a Tenant A Encounter', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);

      const res = await createSubmission(
        doctorBToken,
        encounterId,
        'HEMORRHOID_TREATMENT_DECISION',
        { decisionSummary: 'cross-tenant attempt' },
      );
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // T3 — CarePlan sequence enforcement
  // ==========================================================================
  describe('T3 — CarePlan sequence enforcement', () => {
    it('CarePlan create allowed once Treatment Decision is COMPLETED', async () => {
      const encounterId = await readyForCarePlanEncounter(doctorAToken);
      const res = await createCarePlan(
        doctorAToken,
        encounterId,
        'Điều trị theo đơn (synthetic)',
      );
      expect(res.status).toBe(201);
    });

    it('CarePlan create rejected when Treatment Decision is missing', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);
      // Treatment Decision deliberately never completed.
      const res = await createCarePlan(
        doctorAToken,
        encounterId,
        'Điều trị theo đơn (synthetic)',
      );
      expect(res.status).toBe(409);
    });

    it('CarePlan sign re-checks the prerequisite and cannot be bypassed by frontend state', async () => {
      // Deliberately seed a pre-existing invalid DRAFT to prove sign re-reads
      // authoritative prerequisites. API create is also guarded under DEC-016.
      const encounterId = await createEncounter(doctorAToken, patientAId);
      const e = await prisma.encounter.findUniqueOrThrow({where:{id:encounterId}});
      const draft = await prisma.carePlan.create({data:{tenantId:e.tenantId,patientId:e.patientId,encounterId,instructions:'synthetic pre-existing draft'}});
      const carePlanId = draft.id;

      await completeExamination(doctorAToken, encounterId);
      // Diagnosis/Treatment Decision deliberately never completed.

      const signed = await signCarePlan(doctorAToken, carePlanId);
      expect(signed.status).toBe(409);
    });

    it('unrelated non-Hemorrhoid CarePlan create/sign is unaffected', async () => {
      const res = await request(app.getHttpServer()).post('/encounters').auth(doctorAToken,{type:'bearer'}).send({patientId:patientAId,occurredAt:new Date().toISOString(),reasonForVisit:'synthetic generic'}).expect(201);
      const encounterId=res.body.id;
      const created = await createCarePlan(
        doctorAToken,
        encounterId,
        'Theo dõi GERD (synthetic, non-Hemorrhoid)',
      );
      expect(created.status).toBe(201);
      const signed = await signCarePlan(doctorAToken, created.body.id);
      expect(signed.status).toBe(201);
    });
  });

  // ==========================================================================
  // F1 — concurrent CarePlan sign (ChatGPT T1-T4 source review correction).
  // Real PostgreSQL, no mocked concurrency.
  // ==========================================================================
  describe('F1 — concurrent CarePlan sign', () => {
    it('two concurrent sign() calls against the same DRAFT CarePlan: exactly one commits, loser 409, exactly one versionNumber=1, exactly one OPEN CareTask, currentVersionId points to the sole version', async () => {
      const encounterId = await readyForCarePlanEncounter(doctorAToken);
      const created = await createCarePlan(
        doctorAToken,
        encounterId,
        'Điều trị theo đơn (synthetic, F1 race)',
        '2026-10-10',
      );
      expect(created.status).toBe(201);
      const carePlanId = created.body.id as string;

      const [r1, r2] = await Promise.all([
        signCarePlan(doctorAToken, carePlanId),
        signCarePlan(doctorAToken, carePlanId),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const versions = await prisma.carePlanVersion.findMany({
        where: { carePlanId },
      });
      expect(versions).toHaveLength(1);
      expect(versions[0].versionNumber).toBe(1);

      const openTasks = await prisma.careTask.findMany({
        where: { carePlanId, status: CareTaskStatus.OPEN, timepointCode: null },
      });
      expect(openTasks).toHaveLength(1);

      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      expect(carePlan.status).toBe('SIGNED');
      expect(carePlan.currentVersionId).toBe(versions[0].id);

      const signedEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_SIGNED',
        },
      });
      expect(signedEvents).toHaveLength(1);
    });
  });

  // ==========================================================================
  // T4 — CarePlan/CareTask reconciliation
  // ==========================================================================
  describe('T4 — CarePlan/CareTask reconciliation', () => {
    it('A: null -> date creates one OPEN generic CareTask inside the transaction', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'Cập nhật dặn dò (synthetic)',
          followUpDate: '2026-10-01',
          reason: 'Bổ sung lịch tái khám (synthetic)',
          expectedCurrentVersionId: versionId,
        });
      expect(res.status).toBe(201);
      expect(res.body.careTask).toBeTruthy();
      expect(res.body.careTask.status).toBe(CareTaskStatus.OPEN);

      const tasks = await prisma.careTask.findMany({
        where: { carePlanId, status: CareTaskStatus.OPEN, timepointCode: null },
      });
      expect(tasks).toHaveLength(1);

      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'CarePlan', entityId: carePlanId },
      });
      const reconciled = events.filter(
        (e) => e.action === 'CARE_PLAN_FOLLOW_UP_RECONCILED',
      );
      expect(reconciled).toHaveLength(1);
      expect(
        (reconciled[0].metadata as Record<string, unknown>).reconciliationAction,
      ).toBe('CREATE');
    });

    it('A: null -> date rejected 409 when an OPEN generic task unexpectedly already exists', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );
      // Corrupt state directly — simulates an unexpected pre-existing task.
      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      await prisma.careTask.create({
        data: {
          tenantId: tenantAId,
          patientId: carePlan.patientId,
          carePlanId,
          dueDate: new Date('2026-10-15'),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-10-01',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(res.status).toBe(409);
    });

    it('B: date1 -> date2 with RESCHEDULE updates task dueDate', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      expect(careTaskId).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'RESCHEDULE',
        });
      expect(res.status).toBe(201);
      expect(res.body.careTask.id).toBe(careTaskId);
      expect(new Date(res.body.careTask.dueDate).toISOString().slice(0, 10)).toBe(
        '2026-09-20',
      );

      const reconciled = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(
        (reconciled?.metadata as Record<string, unknown>)?.reconciliationAction,
      ).toBe('RESCHEDULE');
    });

    it('B: date1 -> date2 rejects missing followUpTaskAction when an OPEN task exists', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(res.status).toBe(400);
    });

    it('B: date1 -> date2 rejects CANCEL (invalid while new followUpDate is non-null)', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'CANCEL',
        });
      expect(res.status).toBe(409);
    });

    it('B: date1 -> date2 with KEEP_WITH_REASON keeps the task dueDate and records the reason', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'KEEP_WITH_REASON',
          followUpTaskReason: 'Bệnh nhân yêu cầu giữ lịch cũ (synthetic)',
        });
      expect(res.status).toBe(201);

      const task = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });
      expect(task.dueDate.toISOString().slice(0, 10)).toBe('2026-09-05');

      const reconciled = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
        orderBy: { createdAt: 'desc' },
      });
      const reconciledMetadata = reconciled?.metadata as Record<string, unknown>;
      expect(reconciledMetadata?.reconciliationAction).toBe('KEEP_WITH_REASON');
      expect(reconciledMetadata?.reason).toContain('giữ lịch cũ');
    });

    it('KEEP_WITH_REASON without a reason is rejected (400)', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'KEEP_WITH_REASON',
        });
      expect(res.status).toBe(400);
    });

    it('KEEP_WITH_REASON with an empty-string reason is rejected (400)', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'KEEP_WITH_REASON',
          followUpTaskReason: '',
        });
      expect(res.status).toBe(400);
    });

    it('KEEP_WITH_REASON with a whitespace-only reason is rejected (400) — not silently converted', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'KEEP_WITH_REASON',
          followUpTaskReason: '   ',
        });
      expect(res.status).toBe(400);
    });

    it('KEEP_WITH_REASON with a valid reason padded by whitespace is accepted, and the audit records the trimmed reason', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'KEEP_WITH_REASON',
          followUpTaskReason: '  lý do hợp lệ  ',
        });
      expect(res.status).toBe(201);

      const reconciled = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect((reconciled?.metadata as Record<string, unknown>)?.reason).toBe(
        'lý do hợp lệ',
      );
    });

    it('C: date -> null with CANCEL cancels the OPEN task', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'CANCEL',
        });
      expect(res.status).toBe(201);

      const task = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });
      expect(task.status).toBe(CareTaskStatus.CANCELLED);

      const reconciled = await prisma.auditEvent.findFirst({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(
        (reconciled?.metadata as Record<string, unknown>)?.reconciliationAction,
      ).toBe('CANCEL');
    });

    it('C: date -> null rejects RESCHEDULE (invalid when new followUpDate is null)', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'RESCHEDULE',
        });
      expect(res.status).toBe(409);
    });

    it('F1 — date -> null with zero OPEN generic tasks (prior task already CLOSED): amendment allowed, no reconciliation action needed, and no CARE_PLAN_FOLLOW_UP_RECONCILED event is written', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      // Close the generic follow-up task before the amend, so at amend time
      // zero OPEN generic tasks exist for this CarePlan.
      const completed = await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`);
      expect(completed.status).toBe(201);

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          // followUpDate omitted -> null; no followUpTaskAction supplied.
        });
      expect(res.status).toBe(201);

      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      expect(carePlan.followUpDate).toBeNull();

      const versions = await prisma.carePlanVersion.findMany({
        where: { carePlanId },
      });
      expect(versions).toHaveLength(2); // v1 (sign) + exactly one new v2

      const closedTask = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });
      expect(closedTask.status).toBe(CareTaskStatus.COMPLETED);
      expect(closedTask.dueDate.toISOString().slice(0, 10)).toBe('2026-09-05');

      const amendedEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_AMENDED',
        },
      });
      expect(amendedEvents).toHaveLength(1);

      const reconciledEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(reconciledEvents).toHaveLength(0);
    });

    it('D: unchanged date requires no reconciliation action and does not touch the task', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const before = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'Chỉ đổi nội dung dặn dò (synthetic)',
          followUpDate: '2026-09-05',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(res.status).toBe(201);

      const after = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });
      expect(after.dueDate.getTime()).toBe(before.dueDate.getTime());
      expect(after.status).toBe(before.status);

      const reconciled = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(reconciled).toHaveLength(0);
    });

    it('stale expectedCurrentVersionId is rejected with 409', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );
      // First amend succeeds and advances currentVersionId.
      const first = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'v2',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(first.status).toBe(201);

      // Second amend reuses the now-stale version id.
      const stale = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'v3 attempted from stale state',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        });
      expect(stale.status).toBe(409);
    });

    it('>1 OPEN generic CareTask observed in the transaction is rejected 409, never auto-normalized', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );
      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      // Corrupt state directly: a second OPEN generic task for the same plan.
      await prisma.careTask.create({
        data: {
          tenantId: tenantAId,
          patientId: carePlan.patientId,
          carePlanId,
          dueDate: new Date('2026-09-10'),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'x',
          followUpDate: '2026-09-20',
          reason: 'x',
          expectedCurrentVersionId: versionId,
          followUpTaskAction: 'RESCHEDULE',
        });
      expect(res.status).toBe(409);
    });

    it('CARE_PLAN_AMENDED audit is written inside the same transaction as the version', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );
      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'audit check',
          reason: 'x',
          expectedCurrentVersionId: versionId,
        })
        .expect(201);

      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'CarePlan', entityId: carePlanId },
      });
      expect(events.some((e) => e.action === 'CARE_PLAN_AMENDED')).toBe(true);
      const auditMetadataKeys = events
        .filter((e) => e.action === 'CARE_PLAN_AMENDED')
        .flatMap((e) => Object.keys(e.metadata as Record<string, unknown>));
      expect(auditMetadataKeys).not.toContain('instructions');
    });

    // ------------------------------------------------------------------------
    // C1-C4 — mandatory concurrency tests against real PostgreSQL. No mocking
    // of Prisma/Postgres transaction behavior.
    // ------------------------------------------------------------------------

    it('C1 — concurrent null -> date amendments: exactly one commit, loser 409, one OPEN task, no duplicate audit lineage', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );

      const send = (followUpDate: string) =>
        request(app.getHttpServer())
          .post(`/care-plans/${carePlanId}/amend`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({
            instructions: `race ${followUpDate}`,
            followUpDate,
            reason: 'concurrent C1 (synthetic)',
            expectedCurrentVersionId: versionId,
          });

      const [r1, r2] = await Promise.all([
        send('2026-10-01'),
        send('2026-10-02'),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const versions = await prisma.carePlanVersion.findMany({
        where: { carePlanId },
      });
      expect(versions).toHaveLength(2); // v1 (sign) + exactly one committed v2
      expect(versions.filter((v) => v.versionNumber === 2)).toHaveLength(1);

      const openTasks = await prisma.careTask.findMany({
        where: { carePlanId, status: CareTaskStatus.OPEN, timepointCode: null },
      });
      expect(openTasks).toHaveLength(1);

      const reconciledEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(reconciledEvents).toHaveLength(1);
      const amendedEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_AMENDED',
        },
      });
      expect(amendedEvents).toHaveLength(1);
    });

    it('C2 — concurrent date1 -> date2 amendments: at most one commit, loser 409, one authoritative dueDate, no duplicate OPEN task', async () => {
      const { carePlanId, versionId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-09-05',
      );

      const send = (followUpDate: string) =>
        request(app.getHttpServer())
          .post(`/care-plans/${carePlanId}/amend`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({
            instructions: `race ${followUpDate}`,
            followUpDate,
            reason: 'concurrent C2 (synthetic)',
            expectedCurrentVersionId: versionId,
            followUpTaskAction: 'RESCHEDULE',
          });

      const [r1, r2] = await Promise.all([
        send('2026-09-20'),
        send('2026-09-25'),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const winner = r1.status === 201 ? r1 : r2;
      const task = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId as string },
      });
      expect(task.dueDate.toISOString().slice(0, 10)).toBe(
        new Date(winner.body.careTask.dueDate).toISOString().slice(0, 10),
      );

      const openTasks = await prisma.careTask.findMany({
        where: { carePlanId, status: CareTaskStatus.OPEN, timepointCode: null },
      });
      expect(openTasks).toHaveLength(1);
    });

    it('C3 — concurrent amendment lineage from the same observed version: only one committed successor, no fork', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );

      const send = (instructions: string) =>
        request(app.getHttpServer())
          .post(`/care-plans/${carePlanId}/amend`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({
            instructions,
            reason: 'concurrent C3 (synthetic)',
            expectedCurrentVersionId: versionId,
          });

      const [r1, r2] = await Promise.all([
        send('branch A (synthetic)'),
        send('branch B (synthetic)'),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const successors = await prisma.carePlanVersion.findMany({
        where: { carePlanId, previousVersionId: versionId },
      });
      expect(successors).toHaveLength(1);

      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      expect(carePlan.currentVersionId).toBe(successors[0].id);
    });

    it('C4 — rollback proof: a forced failure before the transaction commits leaves no committed version/task/audit change', async () => {
      const { carePlanId, versionId } = await signedHemorrhoidCarePlan(
        doctorAToken,
      );

      const originalRecord = auditService.record.bind(auditService);
      const recordSpy = jest
        .spyOn(auditService, 'record')
        .mockImplementation(async (input, client) => {
          if (input.action === 'CARE_PLAN_FOLLOW_UP_RECONCILED') {
            throw new Error('C4 injected failure (test-only, synthetic)');
          }
          return originalRecord(input, client);
        });

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'should be rolled back entirely (synthetic)',
          followUpDate: '2026-11-01',
          reason: 'C4 rollback proof (synthetic)',
          expectedCurrentVersionId: versionId,
        });
      expect(res.status).toBe(500);

      recordSpy.mockRestore();

      const versions = await prisma.carePlanVersion.findMany({
        where: { carePlanId },
      });
      expect(versions).toHaveLength(1); // only v1 from sign — no v2 committed

      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      expect(carePlan.currentVersionId).toBe(versionId);
      expect(carePlan.followUpDate).toBeNull();

      const tasks = await prisma.careTask.findMany({ where: { carePlanId } });
      expect(tasks).toHaveLength(0);

      const reconciledEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
        },
      });
      expect(reconciledEvents).toHaveLength(0);
      const amendedEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CarePlan',
          entityId: carePlanId,
          action: 'CARE_PLAN_AMENDED',
        },
      });
      expect(amendedEvents).toHaveLength(0);
    });

    it('F1 — global proof: no CARE_PLAN_FOLLOW_UP_RECONCILED event in this test run ever uses reconciliationAction = NONE (must run after all other T4 tests)', async () => {
      const reconciledEvents = await prisma.auditEvent.findMany({
        where: { entityType: 'CarePlan', action: 'CARE_PLAN_FOLLOW_UP_RECONCILED' },
      });
      expect(reconciledEvents.length).toBeGreaterThan(0);
      const actions = reconciledEvents.map(
        (e) => (e.metadata as Record<string, unknown>).reconciliationAction,
      );
      expect(actions).not.toContain('NONE');
      expect(actions).not.toContain('NOOP');
      expect(actions).not.toContain('SKIP');
      const allowed = ['CREATE', 'RESCHEDULE', 'CANCEL', 'KEEP_WITH_REASON'];
      for (const action of actions) {
        expect(allowed).toContain(action);
      }
    });
  });

  // ==========================================================================
  // T5 — Generic CareTask reschedule + explicit Return Encounter linkage
  // ==========================================================================
  describe('T5 — CareTask reschedule + explicit Return Encounter linkage', () => {
    let patientA2Id: string;
    let tenantBPatientId: string;
    let tenantBEncounterId: string;

    beforeAll(async () => {
      const patientA2 = await prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Hemorrhoid Slice2 Patient A2',
          normalizedFullName: 'synthetic hemorrhoid slice2 patient a2',
          dateOfBirth: new Date('1985-01-01'),
          gender: 'FEMALE',
          phone: '0900000702',
          normalizedPhone: '0900000702',
        },
      });
      patientA2Id = patientA2.id;

      const tenantBPatient = await prisma.patient.create({
        data: {
          tenantId: tenantBId,
          fullName: 'Synthetic Hemorrhoid Slice2 Patient B',
          normalizedFullName: 'synthetic hemorrhoid slice2 patient b',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'MALE',
          phone: '0900000703',
          normalizedPhone: '0900000703',
        },
      });
      tenantBPatientId = tenantBPatient.id;
      tenantBEncounterId = await createEncounter(
        doctorBToken,
        tenantBPatientId,
      );
    });

    async function openGenericTask(): Promise<{
      carePlanId: string;
      careTaskId: string;
      patientId: string;
    }> {
      const { carePlanId, careTaskId } = await signedHemorrhoidCarePlan(
        doctorAToken,
        '2026-11-01',
      );
      expect(careTaskId).toBeTruthy();
      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanId },
      });
      return {
        carePlanId,
        careTaskId: careTaskId as string,
        patientId: carePlan.patientId,
      };
    }

    describe('T5-A — reschedule', () => {
      it('reschedules an OPEN task and leaves CarePlan.followUpDate unchanged', async () => {
        const { carePlanId, careTaskId } = await openGenericTask();
        const before = await prisma.carePlan.findUniqueOrThrow({
          where: { id: carePlanId },
        });

        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/reschedule`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ dueDate: '2026-11-15' });

        expect(res.status).toBe(201);
        expect(
          new Date(res.body.dueDate).toISOString().slice(0, 10),
        ).toBe('2026-11-15');

        const after = await prisma.carePlan.findUniqueOrThrow({
          where: { id: carePlanId },
        });
        expect(after.followUpDate).toEqual(before.followUpDate);

        const events = await prisma.auditEvent.findMany({
          where: {
            entityType: 'CareTask',
            entityId: careTaskId,
            action: 'CARE_TASK_RESCHEDULED',
          },
        });
        expect(events).toHaveLength(1);
        const metadata = events[0].metadata as Record<string, unknown>;
        expect(metadata.newDueDate).toBe(
          new Date('2026-11-15').toISOString(),
        );
        expect(metadata.oldDueDate).toBeTruthy();
      });

      it('rejects reschedule of a COMPLETED task', async () => {
        const { careTaskId } = await openGenericTask();
        await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/reschedule`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ dueDate: '2026-11-20' });
        expect(res.status).toBe(409);
      });

      it('rejects reschedule of a CANCELLED task', async () => {
        const { careTaskId } = await openGenericTask();
        await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/cancel`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/reschedule`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ dueDate: '2026-11-20' });
        expect(res.status).toBe(409);
      });

      it('rejects cross-tenant reschedule', async () => {
        const { careTaskId } = await openGenericTask();
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/reschedule`)
          .set('Authorization', `Bearer ${doctorBToken}`)
          .send({ dueDate: '2026-11-20' });
        expect(res.status).toBe(404);
      });
    });

    describe('T5-B — explicit completion with Return Encounter linkage', () => {
      it('preserves existing completion behavior when no Encounter supplied', async () => {
        const { careTaskId } = await openGenericTask();
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({});
        expect(res.status).toBe(201);
        expect(res.body.status).toBe(CareTaskStatus.COMPLETED);
        expect(res.body.completedByEncounterId ?? null).toBeNull();
      });

      it('completes with a same-patient explicit Return Encounter and persists completedByEncounterId', async () => {
        const { careTaskId, patientId } = await openGenericTask();
        const returnEncounterId = await createEncounter(
          doctorAToken,
          patientId,
          'Tái khám (synthetic)',
        );

        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ completedByEncounterId: returnEncounterId });
        expect(res.status).toBe(201);
        expect(res.body.completedByEncounterId).toBe(returnEncounterId);

        const events = await prisma.auditEvent.findMany({
          where: {
            entityType: 'CareTask',
            entityId: careTaskId,
            action: 'CARE_TASK_COMPLETED',
          },
        });
        expect(events).toHaveLength(1);
        expect(
          (events[0].metadata as Record<string, unknown>)
            .completedByEncounterId,
        ).toBe(returnEncounterId);
      });

      it('rejects completion with a nonexistent Encounter', async () => {
        const { careTaskId } = await openGenericTask();
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ completedByEncounterId: '00000000-0000-0000-0000-000000000000' });
        expect(res.status).toBe(404);
      });

      it('rejects completion with a cross-tenant Encounter', async () => {
        const { careTaskId } = await openGenericTask();
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ completedByEncounterId: tenantBEncounterId });
        expect(res.status).toBe(404);
      });

      it('rejects completion with a same-tenant, different-patient Encounter', async () => {
        const { careTaskId } = await openGenericTask();
        const otherPatientEncounterId = await createEncounter(
          doctorAToken,
          patientA2Id,
        );
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ completedByEncounterId: otherPatientEncounterId });
        expect(res.status).toBe(409);
      });

      it('rejects completion of an already CANCELLED task', async () => {
        const { careTaskId, patientId } = await openGenericTask();
        await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/cancel`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .expect(201);

        const returnEncounterId = await createEncounter(
          doctorAToken,
          patientId,
        );
        const res = await request(app.getHttpServer())
          .post(`/care-tasks/${careTaskId}/complete`)
          .set('Authorization', `Bearer ${doctorAToken}`)
          .send({ completedByEncounterId: returnEncounterId });
        expect(res.status).toBe(409);
      });
    });
  });

  // ==========================================================================
  // T6 — Timeline projection (Diagnosis / Treatment Decision)
  // ==========================================================================
  describe('T6 — Timeline projection', () => {
    async function getTimeline(token: string, patientId: string) {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientId}/timeline`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return res.body as {
        episodes: { events: { type: string; data: Record<string, unknown> }[] }[];
        ungroupedEncounters: { type: string; data: Record<string, unknown> }[];
      };
    }

    function flatten(timeline: {
      episodes: { events: { type: string; data: Record<string, unknown> }[] }[];
      ungroupedEncounters: { type: string; data: Record<string, unknown> }[];
    }) {
      return [
        ...timeline.episodes.flatMap((g) => g.events),
        ...timeline.ungroupedEncounters,
      ];
    }

    it('projects a completed Diagnosis with its summary and encounterId, without a new stored entity', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(
        doctorAToken,
        encounterId,
        'Trĩ nội độ III (synthetic timeline)',
      );

      const timeline = await getTimeline(doctorAToken, patientAId);
      const events = flatten(timeline).filter(
        (e) =>
          e.type === 'CLINICAL_FORM_SUBMITTED' &&
          e.data.templateKey === 'HEMORRHOID_DIAGNOSIS' &&
          e.data.encounterId === encounterId,
      );
      expect(events).toHaveLength(1);
      expect(events[0].data.summary).toBe('Trĩ nội độ III (synthetic timeline)');
      expect(events[0].data.revisionNumber).toBe(1);
      // F3 data minimization — the full responses object must not be
      // projected into the Timeline, only the named summary field.
      expect(events[0].data.responses).toBeUndefined();
    });

    it('projects a completed Treatment Decision with its summary and encounterId', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      await completeDiagnosis(doctorAToken, encounterId);
      await completeTreatmentDecision(
        doctorAToken,
        encounterId,
        'Cắt trĩ Longo (synthetic timeline)',
      );

      const timeline = await getTimeline(doctorAToken, patientAId);
      const events = flatten(timeline).filter(
        (e) =>
          e.type === 'CLINICAL_FORM_SUBMITTED' &&
          e.data.templateKey === 'HEMORRHOID_TREATMENT_DECISION' &&
          e.data.encounterId === encounterId,
      );
      expect(events).toHaveLength(1);
      expect(events[0].data.summary).toBe('Cắt trĩ Longo (synthetic timeline)');
    });

    it('preserves amendment/revision lineage — original Diagnosis remains visible after amendment', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      await completeExamination(doctorAToken, encounterId);
      const originalId = await completeDiagnosis(
        doctorAToken,
        encounterId,
        'Trĩ nội độ II (bản gốc, synthetic)',
      );

      const amendRes = await request(app.getHttpServer())
        .post(`/clinical-forms/${originalId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          responses: { diagnosisSummary: 'Trĩ nội độ III (đã sửa, synthetic)' },
          amendmentReason: 'Đánh giá lại sau khi có thêm dữ liệu (synthetic)',
        });
      expect(amendRes.status).toBe(201);

      const timeline = await getTimeline(doctorAToken, patientAId);
      const events = flatten(timeline)
        .filter(
          (e) =>
            e.type === 'CLINICAL_FORM_SUBMITTED' &&
            e.data.templateKey === 'HEMORRHOID_DIAGNOSIS' &&
            e.data.encounterId === encounterId,
        )
        .sort(
          (a, b) => (a.data.revisionNumber as number) - (b.data.revisionNumber as number),
        );

      expect(events).toHaveLength(2);
      expect(events[0].data.id).toBe(originalId);
      expect(events[0].data.summary).toBe('Trĩ nội độ II (bản gốc, synthetic)');
      expect(events[1].data.summary).toBe('Trĩ nội độ III (đã sửa, synthetic)');
      expect(events[1].data.previousSubmissionId).toBe(originalId);
      expect(events[1].data.amendmentReason).toBe(
        'Đánh giá lại sau khi có thêm dữ liệu (synthetic)',
      );
    });

    it('tenant/patient isolation: Tenant B cannot read Tenant A patient Timeline', async () => {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientAId}/timeline`)
        .set('Authorization', `Bearer ${doctorBToken}`);
      expect(res.status).toBe(404);
    });

    it('F1 — explicit Return Encounter completion is visible in Timeline: CareTask.completedByEncounterId resolves to the correct ENCOUNTER', async () => {
      const { carePlanId } = await signedHemorrhoidCarePlan(doctorAToken, '2026-10-10');
      const carePlan = await prisma.carePlan.findUniqueOrThrow({ where: { id: carePlanId } });
      const openTask = await prisma.careTask.findFirstOrThrow({
        where: { carePlanId, status: CareTaskStatus.OPEN },
      });

      const returnEncounterId = await createEncounter(
        doctorAToken,
        carePlan.patientId,
        'Tái khám (F1 synthetic)',
      );
      const completeRes = await request(app.getHttpServer())
        .post(`/care-tasks/${openTask.id}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ completedByEncounterId: returnEncounterId });
      expect(completeRes.status).toBe(201);

      const timeline = await getTimeline(doctorAToken, carePlan.patientId);
      const events = flatten(timeline);
      const taskEvent = events.find(
        (e) => e.type === 'CARE_TASK' && e.data.id === openTask.id,
      );
      expect(taskEvent).toBeTruthy();
      expect(taskEvent?.data.carePlanId).toBe(carePlanId);
      expect(taskEvent?.data.timepointCode).toBeNull();
      expect(taskEvent?.data.completedByEncounterId).toBe(returnEncounterId);
      expect(taskEvent?.data.completedAt).toBeTruthy();

      // The Return Encounter itself is independently visible in the same
      // Timeline (already-existing ENCOUNTER projection) — resolvable by id.
      const returnEncounterEvent = events.find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === returnEncounterId,
      );
      expect(returnEncounterEvent).toBeTruthy();
      expect(returnEncounterEvent?.data.reasonForVisit).toBe('Tái khám (F1 synthetic)');
    });

    it('F2 — ENCOUNTER Timeline projection exposes carePlanId/carePlanStatus for DRAFT and SIGNED CarePlans', async () => {
      // DRAFT — no sign yet.
      const draftEncounterId = await readyForCarePlanEncounter(doctorAToken);
      const draftCreated = await createCarePlan(
        doctorAToken,
        draftEncounterId,
        'Điều trị (F2 draft synthetic)',
      );
      expect(draftCreated.status).toBe(201);
      const draftCarePlanId = draftCreated.body.id as string;

      let timeline = await getTimeline(doctorAToken, patientAId);
      let encounterEvent = flatten(timeline).find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === draftEncounterId,
      );
      expect(encounterEvent?.data.carePlanId).toBe(draftCarePlanId);
      expect(encounterEvent?.data.carePlanStatus).toBe('DRAFT');

      // SIGNED — separate Encounter/CarePlan.
      const { carePlanId: signedCarePlanId } = await signedHemorrhoidCarePlan(doctorAToken);
      const signedCarePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: signedCarePlanId },
      });

      timeline = await getTimeline(doctorAToken, patientAId);
      encounterEvent = flatten(timeline).find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === signedCarePlan.encounterId,
      );
      expect(encounterEvent?.data.carePlanId).toBe(signedCarePlanId);
      expect(encounterEvent?.data.carePlanStatus).toBe('SIGNED');
    });

    it('an Encounter with no CarePlan yet projects carePlanId/carePlanStatus as null', async () => {
      const encounterId = await createEncounter(doctorAToken, patientAId);
      const timeline = await getTimeline(doctorAToken, patientAId);
      const encounterEvent = flatten(timeline).find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === encounterId,
      );
      expect(encounterEvent?.data.carePlanId).toBeNull();
      expect(encounterEvent?.data.carePlanStatus).toBeNull();
    });
  });
});
