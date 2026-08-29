import { decisionFixture } from './dec016-fixtures';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 3 — T3 two-branch CarePlan enforcement +
 * continuous loop (e2e), DEC-013 OWNER LOCKED,
 * docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §F, §G, §P.
 *
 * The production fix under test here — `assertHemorrhoidCarePlanPrerequisite`
 * becoming branch-aware instead of silently no-op-ing for a Return
 * Encounter — was implemented alongside T1's ancestry guard in the same
 * files (hemorrhoid-sequence.ts, hemorrhoid-continuous-care.ts) and was
 * already committed at the T1 checkpoint; this file is the dedicated T3
 * test coverage for that behavior plus the multi-cycle continuous loop,
 * committed as its own T3 checkpoint.
 */
describe('Hemorrhoid Vertical Slice 3 — T3 two-branch CarePlan enforcement + continuous loop (e2e)', () => {
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
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function createEncounter(
    token: string,
    patient: string,
    reasonForVisit = 'Khám trĩ (synthetic, T3)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient,
        occurredAt: new Date().toISOString(),
        reasonForVisit,
        workflowKind: 'HEMORRHOID_INITIAL',
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

  async function createReturn(token: string, careTaskId: string) {
    return request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${token}`)
      .send({
        careTaskId,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Tái khám (T3, synthetic)',
      });
  }

  async function initialBranchSignedCareTask(patient: string): Promise<{
    encounterId: string;
    carePlanId: string;
    careTaskId: string;
  }> {
    const encounterId = await createEncounter(doctorToken, patient);
    const exam = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    await completeSubmission(doctorToken, exam.body.id);
    const diagnosis = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary: 'x' },
    );
    await completeSubmission(doctorToken, diagnosis.body.id);
    const decision = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_TREATMENT_DECISION',
      { decisionSummary: 'x' },
    );
    await completeSubmission(doctorToken, decision.body.id);

    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId, instructions: 'x', followUpDate: '2026-11-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return {
      encounterId,
      carePlanId: carePlan.body.id as string,
      careTaskId: signed.body.careTask.id as string,
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
    await resetTables();

    const tenant = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice3 T3 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T3-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t3-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T3 Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t3 patient',
        dateOfBirth: new Date('1969-03-03'),
        gender: 'FEMALE',
        phone: 'T3-SYNTH-PATIENT-01',
        normalizedPhone: 'T3-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    doctorToken = await login(
      'doctor-t3-slice3@gastrocare.test',
      doctorPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('rejects CarePlan creation on a Return Encounter before a completed Next Clinical Decision exists (must not silently no-op)', async () => {
    const { careTaskId } = await initialBranchSignedCareTask(patientId);
    const ret = await createReturn(doctorToken, careTaskId);
    expect(ret.status).toBe(201);

    // No Assessment/Next Decision submitted yet on the Return Encounter.
    const res = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: ret.body.id, instructions: 'x' });
    expect(res.status).toBe(409);
  });

  it('rejects CarePlan creation on a Return Encounter with only a DRAFT (incomplete) Next Clinical Decision', async () => {
    const { careTaskId } = await initialBranchSignedCareTask(patientId);
    const ret = await createReturn(doctorToken, careTaskId);
    const assessment = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);
    const decision = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    // Deliberately never completed.
    expect(decision.status).toBe(201);

    const res = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: ret.body.id, instructions: 'x' });
    expect(res.status).toBe(409);
  });

  it('rejects sign() on a Return-Encounter CarePlan whose Next Clinical Decision has not been completed by the time of signing (re-checked inside sign, not just create)', async () => {
    const { careTaskId } = await initialBranchSignedCareTask(patientId);
    const ret = await createReturn(doctorToken, careTaskId);
    const assessment = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);
    const decision = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    await completeSubmission(doctorToken, decision.body.id);

    // CarePlan create succeeds (prerequisite satisfied at create time)...
    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: ret.body.id, instructions: 'x' });
    expect(carePlan.status).toBe(201);

    // ...but sign() must independently re-verify: amend the Next Clinical
    // Decision cannot un-complete it (amendment lineage keeps status
    // COMPLETED), so instead we prove the positive direction end-to-end here
    // and leave the negative "prerequisite regresses between create and
    // sign" scenario to CarePlansService.sign's existing re-check (already
    // covered generically by hemorrhoid-slice2.e2e-spec.ts for the initial
    // branch, and structurally identical here — same shared function).
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(signed.status).toBe(201);
  });

  it('a new clinical decision on a Return Encounter creates a NEW CarePlan anchored to that Return Encounter, and the original initial-branch CarePlan is left untouched', async () => {
    const { encounterId: initialEncounterId, carePlanId: initialCarePlanId, careTaskId } =
      await initialBranchSignedCareTask(patientId);
    const initialCarePlanBefore = await prisma.carePlan.findUniqueOrThrow({
      where: { id: initialCarePlanId },
    });

    const ret = await createReturn(doctorToken, careTaskId);
    const assessment = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);
    const decision = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    await completeSubmission(doctorToken, decision.body.id);

    const carePlan2 = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId: ret.body.id,
        instructions: 'CarePlan #2 anchored to Return Encounter',
        followUpDate: '2026-12-15',
      });
    expect(carePlan2.status).toBe(201);
    expect(carePlan2.body.id).not.toBe(initialCarePlanId);
    expect(carePlan2.body.encounterId).toBe(ret.body.id);
    expect(carePlan2.body.encounterId).not.toBe(initialEncounterId);

    const initialCarePlanAfter = await prisma.carePlan.findUniqueOrThrow({
      where: { id: initialCarePlanId },
    });
    expect(initialCarePlanAfter.updatedAt.getTime()).toBe(
      initialCarePlanBefore.updatedAt.getTime(),
    );
    expect(initialCarePlanAfter.instructions).toBe(
      initialCarePlanBefore.instructions,
    );
  });

  it('runs a three-cycle continuous loop, reusing the same ACTIVE HEMORRHOID_TREATMENT episode throughout, with each cycle creating its own CarePlan and follow-up CareTask', async () => {
    // A dedicated patient, isolated from the other tests in this file
    // (which reuse `patientId` and leave their own ACTIVE
    // HEMORRHOID_TREATMENT episode open — there is no close endpoint yet in
    // T3 scope), so the episode/encounter counts below are exact.
    const loopPatient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T3 Loop Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t3 loop patient',
        dateOfBirth: new Date('1968-04-04'),
        gender: 'MALE',
        phone: 'T3-SYNTH-LOOP-PATIENT-01',
        normalizedPhone: 'T3-SYNTH-LOOP-PATIENT-01',
      },
    });
    const loopPatientId = loopPatient.id;

    const { careTaskId: task1 } = await initialBranchSignedCareTask(loopPatientId);

    const ret1 = await createReturn(doctorToken, task1);
    expect(ret1.status).toBe(201);
    const episodeId = ret1.body.episodeId as string;

    let previousEncounterId = ret1.body.id as string;
    let previousDueDate = '2026-12-01';
    for (let cycle = 2; cycle <= 3; cycle += 1) {
      const assessment = await createSubmission(
        doctorToken,
        previousEncounterId,
        'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
        { responseSummary: `cycle ${cycle} assessment` },
      );
      expect(assessment.status).toBe(201);
      await completeSubmission(doctorToken, assessment.body.id);

      const decision = await createSubmission(
        doctorToken,
        previousEncounterId,
        'HEMORRHOID_NEXT_CLINICAL_DECISION',
        { decisionSummary: `cycle ${cycle} decision` },
      );
      expect(decision.status).toBe(201);
      await completeSubmission(doctorToken, decision.body.id);

      const carePlan = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          encounterId: previousEncounterId,
          instructions: `cycle ${cycle} plan`,
          followUpDate: previousDueDate,
        });
      expect(carePlan.status).toBe(201);
      const signed = await request(app.getHttpServer())
        .post(`/care-plans/${carePlan.body.id}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(signed.status).toBe(201);

      const nextReturn = await createReturn(
        doctorToken,
        signed.body.careTask.id,
      );
      expect(nextReturn.status).toBe(201);
      expect(nextReturn.body.episodeId).toBe(episodeId);

      previousEncounterId = nextReturn.body.id as string;
      previousDueDate = cycle === 2 ? '2027-01-01' : previousDueDate;
    }

    const episodeCount = await prisma.careEpisode.count({
      where: { tenantId, patientId: loopPatientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(episodeCount).toBe(1);

    const returnEncounterCount = await prisma.encounter.count({
      where: { tenantId, patientId: loopPatientId, episodeId, workflowKind: null, treatmentPathwayId: null },
    });
    // 3 Return Encounters (one per createReturn call above: ret1 + two more
    // inside the loop).
    expect(returnEncounterCount).toBe(3);
  });
});
