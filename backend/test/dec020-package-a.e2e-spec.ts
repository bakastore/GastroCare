import { decisionFixture } from './dec016-fixtures';
import { activateHemorrhoidTreatment } from './dec021-activation-helper';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, CareEpisodeStatus, CareTaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';

/**
 * DEC-020 Package A — Workflow Semantic Reconciliation (e2e).
 * Authority: DEC-020 v0.2 OWNER LOCKED +
 * docs/DEC-020_PACKAGE_A_WORKFLOW_SEMANTIC_RECONCILIATION_IMPLEMENTATION_CONTRACT.md
 * v0.2 OWNER LOCKED. Real PostgreSQL, SERIALIZABLE, no mocking of concurrency.
 *
 * Covers the Contract §14 minimum backend behaviour list:
 *   1  Initial HEMORRHOID_INITIAL Encounter -> episodeId = null
 *   2  first-ever Return with 0 ACTIVE -> exactly one ACTIVE CareEpisode
 *   3  Return with 1 ACTIVE -> reuse it
 *   4  >1 ACTIVE -> deterministic conflict
 *   5  simultaneous first Returns -> single-active invariant preserved
 *   6  post-closure Return requires explicit REOPEN_EXISTING / START_NEW
 *   7  concurrent reopen / start-new -> single-active invariant preserved
 *   8  close with completed assessment succeeds
 *   9  close without assessment also succeeds via explicit DOCTOR flow
 *   10 non-DOCTOR close rejected
 *   11 close does not silently cancel open CareTask / TreatmentPathway
 *   12 tenant / patient isolation preserved
 *   13 Return <-> CareTask atomic completion preserved
 */
describe('DEC-020 Package A — Workflow Semantic Reconciliation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let otherTenantId: string;
  let doctorToken: string;
  let nurseToken: string;
  let otherDoctorToken: string;

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

  let patientSeq = 0;
  async function createPatient(tenant = tenantId): Promise<string> {
    patientSeq += 1;
    const p = await prisma.patient.create({
      data: {
        tenantId: tenant,
        fullName: `Synthetic DEC020-A Patient ${patientSeq}`,
        normalizedFullName: `synthetic dec020-a patient ${patientSeq}`,
        dateOfBirth: new Date('1970-01-01'),
        gender: 'OTHER',
        phone: `DEC020A-${patientSeq}`,
        normalizedPhone: `DEC020A-${patientSeq}`,
      },
    });
    return p.id;
  }

  function createInitial(patientId: string, token = doctorToken) {
    return request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Khám trĩ lần đầu (synthetic)',
        workflowKind: 'HEMORRHOID_INITIAL',
      });
  }

  async function createSubmission(
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown> = {},
    token = doctorToken,
  ) {
    const f = await request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ encounterId, templateKey, responses: decisionFixture(templateKey, responses) })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/clinical-forms/${f.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return f.body;
  }

  /**
   * Initial Encounter driven through Examination -> Diagnosis -> (optional
   * Structured Treatment Activation) -> signed CarePlan; returns the OPEN
   * generic follow-up CareTask id.
   *
   * DEC-021 R9 finding 1: a Return Encounter no longer creates/reopens the
   * HEMORRHOID_TREATMENT episode. `activate: true` (default) establishes the
   * ACTIVE episode via Structured Treatment Activation first, so the Return
   * has an episode to reuse. `activate: false` leaves the Encounter ungrouped
   * (for tests that assert a Return alone cannot create an episode).
   */
  async function readyOpenFollowUpTask(
    patientId: string,
    activate = true,
  ): Promise<string> {
    const initial = await createInitial(patientId).expect(201);
    expect(initial.body.episodeId).toBeNull();
    await createSubmission(initial.body.id, 'HEMORRHOID_EXAMINATION');
    await createSubmission(initial.body.id, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    if (activate) {
      await activateHemorrhoidTreatment(app, doctorToken, initial.body.id);
    } else {
      await createSubmission(initial.body.id, 'HEMORRHOID_TREATMENT_DECISION', {
        decisionSummary: 'synthetic',
      });
    }
    const plan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: initial.body.id, instructions: 'x', followUpDate: '2026-11-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${plan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return signed.body.careTask.id as string;
  }

  /** Continuous-care branch on a Return Encounter -> a fresh OPEN task. */
  async function nextFollowUpTaskFromReturn(returnEncounterId: string): Promise<string> {
    await createSubmission(returnEncounterId, 'HEMORRHOID_FOLLOW_UP_ASSESSMENT', {
      responseSummary: 'synthetic',
    });
    await createSubmission(returnEncounterId, 'HEMORRHOID_NEXT_CLINICAL_DECISION', {
      decisionSummary: 'synthetic',
    });
    const plan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: returnEncounterId, instructions: 'x', followUpDate: '2026-12-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${plan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return signed.body.careTask.id as string;
  }

  function createReturn(
    careTaskId: string,
    extra: Record<string, unknown> = {},
    token = doctorToken,
  ) {
    return request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${token}`)
      .send({
        careTaskId,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Tái khám (synthetic)',
        ...extra,
      });
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

    const tenant = await prisma.tenant.create({ data: { name: 'DEC020-A Tenant' } });
    tenantId = tenant.id;
    const other = await prisma.tenant.create({ data: { name: 'DEC020-A Other Tenant' } });
    otherTenantId = other.id;

    const pass = 'DEC020-A-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-dec020a@gastrocare.test',
        passwordHash: await bcrypt.hash(pass, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'nurse-dec020a@gastrocare.test',
        passwordHash: await bcrypt.hash(pass, 10),
        role: AuthRole.NURSE,
        tenantId,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'doctor-other-dec020a@gastrocare.test',
        passwordHash: await bcrypt.hash(pass, 10),
        role: AuthRole.DOCTOR,
        tenantId: otherTenantId,
      },
    });
    doctorToken = await login('doctor-dec020a@gastrocare.test', pass);
    nurseToken = await login('nurse-dec020a@gastrocare.test', pass);
    otherDoctorToken = await login('doctor-other-dec020a@gastrocare.test', pass);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('1: HEMORRHOID_INITIAL Encounter is ungrouped (episodeId null) and creates no CareEpisode', async () => {
    const patientId = await createPatient();
    const res = await createInitial(patientId).expect(201);
    expect(res.body.episodeId).toBeNull();
    expect(res.body.workflowKind).toBe('HEMORRHOID_INITIAL');
    expect(
      await prisma.careEpisode.count({ where: { patientId } }),
    ).toBe(0);
  });

  it('2 (DEC-021 R9): the ACTIVE episode is created by Structured Treatment Activation, not by the Return; the Return reuses it', async () => {
    const patientId = await createPatient();
    const taskId = await readyOpenFollowUpTask(patientId); // activates treatment
    const preExisting = await prisma.careEpisode.findFirstOrThrow({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(preExisting.status).toBe(CareEpisodeStatus.ACTIVE);

    const ret = await createReturn(taskId);
    expect(ret.status).toBe(201);
    const episodes = await prisma.careEpisode.findMany({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(episodes).toHaveLength(1);
    expect(episodes[0].id).toBe(preExisting.id);
    expect(episodes[0].status).toBe(CareEpisodeStatus.ACTIVE);
    expect(ret.body.episodeId).toBe(preExisting.id);
    // startedAt is unchanged by the Return (set at activation).
    expect(episodes[0].startedAt.toISOString()).toBe(
      preExisting.startedAt.toISOString(),
    );
  });

  it('3: a subsequent Return with 1 ACTIVE reuses that same episode', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1);
    expect(ret1.status).toBe(201);
    const task2 = await nextFollowUpTaskFromReturn(ret1.body.id);
    const ret2 = await createReturn(task2);
    expect(ret2.status).toBe(201);
    expect(ret2.body.episodeId).toBe(ret1.body.episodeId);
    expect(
      await prisma.careEpisode.count({
        where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
      }),
    ).toBe(1);
  });

  it('4: >1 ACTIVE HEMORRHOID_TREATMENT episode is a deterministic conflict (DB partial unique index; DEC-021 §4.1)', async () => {
    const patientId = await createPatient();
    await prisma.careEpisode.create({
      data: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'ACTIVE', startedAt: new Date() },
    });
    // DEC-021 §4.1 — a second ACTIVE row for the same (tenant, patient) is
    // now rejected at the database by the partial unique index
    // `care_episodes_one_active_hemorrhoid_per_patient`, so the >1 state is
    // not reachable even by a direct write that bypasses the Serializable
    // helper. The Return service's `activeEpisodes.length > 1` branch remains
    // as defense-in-depth but can no longer be provoked in a normal DB.
    await expect(
      prisma.careEpisode.create({
        data: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'ACTIVE', startedAt: new Date() },
      }),
    ).rejects.toThrow();
    // a CLOSED second row is still allowed (partial predicate excludes it)
    const closed = await prisma.careEpisode.create({
      data: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'CLOSED', startedAt: new Date(), endedAt: new Date() },
    });
    expect(closed.status).toBe('CLOSED');
  });

  it('5: simultaneous first Returns for one patient never create two ACTIVE episodes', async () => {
    const patientId = await createPatient();
    const taskA = await readyOpenFollowUpTask(patientId);
    const taskB = await readyOpenFollowUpTask(patientId);
    const [r1, r2] = await Promise.all([createReturn(taskA), createReturn(taskB)]);
    for (const r of [r1, r2]) expect([201, 409]).toContain(r.status);
    expect([r1.status, r2.status]).toContain(201);
    expect(
      await prisma.careEpisode.count({
        where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'ACTIVE' },
      }),
    ).toBe(1);
  });

  /** Drives a patient to: one CLOSED HEMORRHOID_TREATMENT episode + 0 ACTIVE
   * + an OPEN generic follow-up task on a fresh UNGROUPED Initial Encounter.
   * DEC-021 R9: recurrence (reopen / start-new) is Structured Treatment
   * Activation only — a Return with such a task now just proves it cannot
   * create/reopen an episode. */
  async function patientWithClosedHistory(): Promise<{
    patientId: string;
    closedEpisodeId: string;
    openTaskId: string;
  }> {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    // Fresh ungrouped Initial follow-up task (no activation — the patient now
    // has CLOSED history and no ACTIVE episode).
    const openTaskId = await readyOpenFollowUpTask(patientId, false);
    return { patientId, closedEpisodeId: ret1.body.episodeId as string, openTaskId };
  }

  // DEC-021 R9 finding 1 — recurrence (reopen / start-new) is NO LONGER
  // handled on the Return request. A Return Encounter can only reuse an
  // already-ACTIVE episode; create/reopen is Structured Treatment Activation
  // only. Positive recurrence-via-activation coverage lives in
  // test/dec021-package-r.e2e-spec.ts (#9 REOPEN_EXISTING, R9-1b/R9-1c).

  it('6 (A): a Return with CLOSED history + 0 ACTIVE and no choice is rejected and mutates nothing', async () => {
    const { patientId, openTaskId } = await patientWithClosedHistory();
    const blocked = await createReturn(openTaskId);
    expect(blocked.status).toBe(409);
    expect(
      await prisma.careEpisode.count({
        where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
      }),
    ).toBe(1);
    expect(
      (await prisma.careTask.findUniqueOrThrow({ where: { id: openTaskId } })).status,
    ).toBe(CareTaskStatus.OPEN);
  });

  it('6b/6c: a Return carrying REOPEN_EXISTING or START_NEW is rejected (400); no episode is created or reopened', async () => {
    const { patientId, closedEpisodeId, openTaskId } = await patientWithClosedHistory();
    for (const body of [
      { recurrenceAction: 'START_NEW' },
      {
        recurrenceAction: 'REOPEN_EXISTING',
        recurrenceClosedEpisodeId: closedEpisodeId,
        recurrenceReason: 'Tái phát (synthetic)',
      },
    ]) {
      const ret = await createReturn(openTaskId, body);
      expect(ret.status).toBe(400);
    }
    expect(
      (await prisma.careEpisode.findUniqueOrThrow({ where: { id: closedEpisodeId } })).status,
    ).toBe(CareEpisodeStatus.CLOSED);
    expect(
      await prisma.careEpisode.count({
        where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'ACTIVE' },
      }),
    ).toBe(0);
    expect(
      (await prisma.careTask.findUniqueOrThrow({ where: { id: openTaskId } })).status,
    ).toBe(CareTaskStatus.OPEN);
  });

  it('7b (G): a recurrence choice on a Return while an ACTIVE episode exists is rejected (400), not silently ignored', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId); // establishes the ACTIVE episode via activation
    const active = await prisma.careEpisode.findFirstOrThrow({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT', status: 'ACTIVE' },
    });
    const ret = await createReturn(task1, {
      recurrenceAction: 'REOPEN_EXISTING',
      recurrenceClosedEpisodeId: active.id,
      recurrenceReason: 'stale (synthetic)',
    });
    expect(ret.status).toBe(400);
  });

  it('T11 P2-01 (11): the standalone POST /care-episodes/:id/reopen keeps its own reason bounds (<=500 ok, 501 → 400)', async () => {
    const { closedEpisodeId } = await patientWithClosedHistory();
    const ok = await request(app.getHttpServer())
      .post(`/care-episodes/${closedEpisodeId}/reopen`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ reason: 'r'.repeat(500) });
    expect(ok.status).toBe(201);
    // Close again so the 501 attempt starts from CLOSED.
    await request(app.getHttpServer())
      .post(`/care-episodes/${closedEpisodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const tooLong = await request(app.getHttpServer())
      .post(`/care-episodes/${closedEpisodeId}/reopen`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ reason: 'r'.repeat(501) });
    expect(tooLong.status).toBe(400);
  });

  it('8: close succeeds with a completed HEMORRHOID_FOLLOW_UP_ASSESSMENT', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    await createSubmission(ret1.body.id, 'HEMORRHOID_FOLLOW_UP_ASSESSMENT', {
      responseSummary: 'synthetic',
    });
    const res = await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(CareEpisodeStatus.CLOSED);
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: ret1.body.episodeId, action: 'CARE_EPISODE_CLOSED' },
    });
    expect((audit.metadata as Record<string, unknown>).followUpAssessmentPresent).toBe(true);
  });

  it('9: close also succeeds with NO completed assessment, via the explicit DOCTOR flow', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    const res = await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(CareEpisodeStatus.CLOSED);
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: ret1.body.episodeId, action: 'CARE_EPISODE_CLOSED' },
    });
    expect((audit.metadata as Record<string, unknown>).followUpAssessmentPresent).toBe(false);
    expect((audit.metadata as Record<string, unknown>).status).toBe(CareEpisodeStatus.CLOSED);
  });

  it('10: a non-DOCTOR (NURSE) close is rejected', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .expect(403);
    expect(
      (await prisma.careEpisode.findUniqueOrThrow({ where: { id: ret1.body.episodeId } })).status,
    ).toBe(CareEpisodeStatus.ACTIVE);
  });

  it('11 (DEC-021 D20-03 §7): closing an episode CANCELS authoritatively linked OPEN CareTasks (reason EPISODE_CLOSED) but does not touch a TreatmentPathway', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    // An open follow-up task on the episode (linked via
    // carePlan.encounter.episodeId), and a TreatmentPathway under it.
    const openTask = await nextFollowUpTaskFromReturn(ret1.body.id);
    const pathway = await request(app.getHttpServer())
      .post('/treatment-pathways')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ caseId: ret1.body.episodeId, modality: 'MEDICAL', startedAt: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);

    // DEC-021 D20-03: the linked OPEN task is now deterministically CANCELLED.
    const taskAfter = await prisma.careTask.findUniqueOrThrow({
      where: { id: openTask },
    });
    expect(taskAfter.status).toBe(CareTaskStatus.CANCELLED);
    expect(taskAfter.cancelledAt).not.toBeNull();
    const disposition = await prisma.auditEvent.findFirst({
      where: { action: 'CARE_TASK_DISPOSED_ON_EPISODE_CLOSE', entityId: openTask },
    });
    expect(disposition).not.toBeNull();
    expect((disposition!.metadata as Record<string, unknown>).reason).toBe(
      'EPISODE_CLOSED',
    );
    // TreatmentPathway is NOT touched by Episode close.
    const pathwayAfter = await prisma.treatmentPathway.findUniqueOrThrow({
      where: { id: pathway.body.id },
    });
    expect(pathwayAfter.endedAt).toBeNull();
  });

  it('12: Return and close are tenant/patient isolated — a foreign DOCTOR cannot drive them', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    // Foreign DOCTOR cannot create a Return for this tenant's CareTask.
    const foreignReturn = await createReturn(task1, {}, otherDoctorToken);
    expect([403, 404]).toContain(foreignReturn.status);
    const ret1 = await createReturn(task1).expect(201);
    // Foreign DOCTOR cannot close this tenant's episode.
    await request(app.getHttpServer())
      .post(`/care-episodes/${ret1.body.episodeId}/close`)
      .set('Authorization', `Bearer ${otherDoctorToken}`)
      .expect(404);
    expect(
      (await prisma.careEpisode.findUniqueOrThrow({ where: { id: ret1.body.episodeId } })).status,
    ).toBe(CareEpisodeStatus.ACTIVE);
  });

  it('13: Return <-> CareTask completion is atomic — the Return commits with its task COMPLETED and linked', async () => {
    const patientId = await createPatient();
    const task1 = await readyOpenFollowUpTask(patientId);
    const ret1 = await createReturn(task1).expect(201);
    const task = await prisma.careTask.findUniqueOrThrow({ where: { id: task1 } });
    expect(task.status).toBe(CareTaskStatus.COMPLETED);
    expect(task.completedByEncounterId).toBe(ret1.body.id);
    // A second Return against the same (now completed) task is rejected.
    const again = await createReturn(task1);
    expect(again.status).toBe(409);
  });
});
