import { decisionFixture } from './dec016-fixtures';
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
 * Hemorrhoid Vertical Slice 3 — T4 episode lifecycle/concurrency (e2e),
 * DEC-013 OWNER LOCKED, docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
 * §L, §M, §Q, §R, §W. Real PostgreSQL, SERIALIZABLE, no mocking of
 * concurrency itself (C4's forced-failure injection excepted, same
 * established convention as hemorrhoid-slice2.e2e-spec.ts's own C4).
 */
describe('Hemorrhoid Vertical Slice 3 — T4 episode lifecycle/concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let auditService: AuditService;

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

  async function createPatient(suffix: string) {
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: `Synthetic Hemorrhoid Slice3 T4 Patient ${suffix}`,
        normalizedFullName: `synthetic hemorrhoid slice3 t4 patient ${suffix}`.toLowerCase(),
        dateOfBirth: new Date('1966-06-06'),
        gender: 'MALE',
        phone: `T4-SYNTH-PATIENT-${suffix}`,
        normalizedPhone: `T4-SYNTH-PATIENT-${suffix}`,
      },
    });
    return patient.id;
  }

  async function createEncounter(
    token: string,
    patient: string,
    reasonForVisit = 'Khám trĩ (synthetic, T4)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workflowKind: 'HEMORRHOID_INITIAL',
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
        reasonForVisit: 'Tái khám (T4, synthetic)',
      });
  }

  /** Initial branch through to a signed CarePlan with one OPEN generic
   * follow-up CareTask, for a given patient. */
  async function readyOpenFollowUpTask(patient: string): Promise<string> {
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
    return signed.body.careTask.id as string;
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

    const tenant = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice3 T4 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T4-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t4-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });
    doctorToken = await login(
      'doctor-t4-slice3@gastrocare.test',
      doctorPassword,
    );

    patientId = await createPatient('MAIN');
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  // ==========================================================================
  // Direct-create control (Contract §L)
  // ==========================================================================
  describe('direct CareEpisode creation control', () => {
    it('allows creating the first ACTIVE HEMORRHOID_TREATMENT episode directly', async () => {
      const patient = await createPatient('DIRECT1');
      const res = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          startedAt: new Date().toISOString(),
        });
      expect(res.status).toBe(201);
      expect(res.body.episodeType).toBe('HEMORRHOID_TREATMENT');
      expect(res.body.status).toBe(CareEpisodeStatus.ACTIVE);
    });

    it('rejects a second direct ACTIVE HEMORRHOID_TREATMENT episode for the same patient with 409', async () => {
      const patient = await createPatient('DIRECT2');
      const first = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          startedAt: new Date().toISOString(),
        });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          startedAt: new Date().toISOString(),
        });
      expect(second.status).toBe(409);
    });

    it('rejects retired direct LONGO_TREATMENT creation (multiple pathways are tested under DEC-016)', async () => {
      const patient = await createPatient('LONGO1');
      const first = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient,
          episodeType: 'LONGO_TREATMENT',
          startedAt: new Date().toISOString(),
        });
      expect(first.status).toBe(400);

      const second = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient,
          episodeType: 'LONGO_TREATMENT',
          startedAt: new Date().toISOString(),
        });
      expect(second.status).toBe(400);
    });
  });

  // ==========================================================================
  // Reopen invariant (Contract §M)
  // ==========================================================================
  describe('reopen invariant', () => {
    it('rejects reopening a CLOSED HEMORRHOID_TREATMENT episode when another ACTIVE one already exists for the same patient', async () => {
      const patient = await createPatient('REOPEN1');
      const episodeA = await prisma.careEpisode.create({
        data: {
          tenantId,
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          status: CareEpisodeStatus.CLOSED,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
      // A second, currently ACTIVE, Hemorrhoid episode for the same patient
      // (synthetic direct DB setup — this shape cannot occur via the
      // application's own guarded paths, but reopen() must still defend
      // against it authoritatively rather than assume it never happens).
      await prisma.careEpisode.create({
        data: {
          tenantId,
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          status: CareEpisodeStatus.ACTIVE,
          startedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-episodes/${episodeA.id}/reopen`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ reason: 'x' });
      expect(res.status).toBe(409);
    });

    it('allows reopening a CLOSED HEMORRHOID_TREATMENT episode when no other ACTIVE one exists', async () => {
      const patient = await createPatient('REOPEN2');
      const episode = await prisma.careEpisode.create({
        data: {
          tenantId,
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          status: CareEpisodeStatus.CLOSED,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-episodes/${episode.id}/reopen`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ reason: 'x' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(CareEpisodeStatus.ACTIVE);
    });
  });

  // ==========================================================================
  // DEC-020 D20-03: close is a DOCTOR explicit action; a completed
  // HEMORRHOID_FOLLOW_UP_ASSESSMENT is DESIRABLE but NOT a hard prerequisite.
  // ==========================================================================
  describe('close behavior', () => {
    it('DEC-020: allows an explicit DOCTOR close of an ACTIVE HEMORRHOID_TREATMENT episode with no COMPLETED HEMORRHOID_FOLLOW_UP_ASSESSMENT', async () => {
      const patient = await createPatient('CLOSE1');
      const careTaskId = await readyOpenFollowUpTask(patient);
      const ret = await createReturn(doctorToken, careTaskId);
      expect(ret.status).toBe(201);
      const episodeId = ret.body.episodeId as string;

      // No Assessment submitted at all — close still proceeds.
      const res = await request(app.getHttpServer())
        .post(`/care-episodes/${episodeId}/close`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(CareEpisodeStatus.CLOSED);

      // The close audit records, factually, that no assessment was present.
      const closeEvent = await prisma.auditEvent.findFirstOrThrow({
        where: { entityId: episodeId, action: 'CARE_EPISODE_CLOSED' },
      });
      expect(
        (closeEvent.metadata as Record<string, unknown>)
          .followUpAssessmentPresent,
      ).toBe(false);
    });

    it('allows closing an ACTIVE HEMORRHOID_TREATMENT episode once a COMPLETED HEMORRHOID_FOLLOW_UP_ASSESSMENT exists on an Encounter in it', async () => {
      const patient = await createPatient('CLOSE2');
      const careTaskId = await readyOpenFollowUpTask(patient);
      const ret = await createReturn(doctorToken, careTaskId);
      const episodeId = ret.body.episodeId as string;

      const assessment = await createSubmission(
        doctorToken,
        ret.body.id,
        'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
        { responseSummary: 'x' },
      );
      await completeSubmission(doctorToken, assessment.body.id);

      const res = await request(app.getHttpServer())
        .post(`/care-episodes/${episodeId}/close`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(CareEpisodeStatus.CLOSED);
    });

    it('does not rewrite unrelated historical state on close (Encounter/CarePlan/completed forms untouched)', async () => {
      const patient = await createPatient('CLOSE3');
      const careTaskId = await readyOpenFollowUpTask(patient);
      const ret = await createReturn(doctorToken, careTaskId);
      const episodeId = ret.body.episodeId as string;

      const assessment = await createSubmission(
        doctorToken,
        ret.body.id,
        'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
        { responseSummary: 'unaffected by close (synthetic)' },
      );
      await completeSubmission(doctorToken, assessment.body.id);

      const encounterBefore = await prisma.encounter.findUniqueOrThrow({
        where: { id: ret.body.id },
      });
      const submissionBefore = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: assessment.body.id },
      });

      const res = await request(app.getHttpServer())
        .post(`/care-episodes/${episodeId}/close`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(201);

      const encounterAfter = await prisma.encounter.findUniqueOrThrow({
        where: { id: ret.body.id },
      });
      const submissionAfter = await prisma.clinicalFormSubmission.findUniqueOrThrow({
        where: { id: assessment.body.id },
      });
      expect(encounterAfter).toEqual(encounterBefore);
      expect(submissionAfter).toEqual(submissionBefore);
    });
  });

  // ==========================================================================
  // C1-C4 — mandatory real-PostgreSQL concurrency tests (Contract §W)
  // ==========================================================================
  describe('C1-C4 mandatory concurrency', () => {
    it('C1 — same CareTask double-submit: exactly one commit, one Return Encounter, one completed task, one completedByEncounterId, loser 409', async () => {
      const patient = await createPatient('C1');
      const careTaskId = await readyOpenFollowUpTask(patient);

      const [r1, r2] = await Promise.all([
        createReturn(doctorToken, careTaskId),
        createReturn(doctorToken, careTaskId),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const task = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId },
      });
      expect(task.status).toBe(CareTaskStatus.COMPLETED);
      expect(task.completedByEncounterId).toBeTruthy();

      const returnEncounters = await prisma.encounter.count({
        where: { tenantId, patientId: patient, episodeId: { not: null }, workflowKind: null, treatmentPathwayId: null },
      });
      expect(returnEncounters).toBe(1);

      const completedEvents = await prisma.auditEvent.findMany({
        where: {
          entityType: 'CareTask',
          entityId: careTaskId,
          action: 'CARE_TASK_COMPLETED',
        },
      });
      expect(completedEvents).toHaveLength(1);
    });

    it('C2 — concurrent first returns for the same patient (two different eligible CareTasks): never more than one ACTIVE HEMORRHOID_TREATMENT episode is committed', async () => {
      const patient = await createPatient('C2');
      // Setup is sequential (each is itself several sequential requests);
      // only the two createReturn() calls below race concurrently — that is
      // the actual invariant under test.
      const taskA = await readyOpenFollowUpTask(patient);
      const taskB = await readyOpenFollowUpTask(patient);

      const [r1, r2] = await Promise.all([
        createReturn(doctorToken, taskA),
        createReturn(doctorToken, taskB),
      ]);

      // Regardless of whether Postgres serializes these into one 201 + one
      // 409, or both succeed by genuinely serializing one after the other
      // (the second correctly observing and reusing the first's committed
      // episode) — the invariant that must never break either way is: at
      // most one ACTIVE HEMORRHOID_TREATMENT episode ever exists for this
      // patient afterward.
      for (const res of [r1, r2]) {
        expect([201, 409]).toContain(res.status);
      }
      expect([r1.status, r2.status]).toContain(201);

      const activeEpisodes = await prisma.careEpisode.findMany({
        where: {
          tenantId,
          patientId: patient,
          episodeType: 'HEMORRHOID_TREATMENT',
          status: CareEpisodeStatus.ACTIVE,
        },
      });
      expect(activeEpisodes).toHaveLength(1);
    });

    it('C3 — close vs new Return: never commits a new Return Encounter into a concurrently CLOSED episode', async () => {
      const patient = await createPatient('C3');
      const firstTaskId = await readyOpenFollowUpTask(patient);
      const firstReturn = await createReturn(doctorToken, firstTaskId);
      expect(firstReturn.status).toBe(201);
      const episodeId = firstReturn.body.episodeId as string;

      const assessment = await createSubmission(
        doctorToken,
        firstReturn.body.id,
        'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
        { responseSummary: 'x' },
      );
      await completeSubmission(doctorToken, assessment.body.id);
      const nextDecision = await createSubmission(
        doctorToken,
        firstReturn.body.id,
        'HEMORRHOID_NEXT_CLINICAL_DECISION',
        { decisionSummary: 'x' },
      );
      await completeSubmission(doctorToken, nextDecision.body.id);
      const carePlan2 = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          encounterId: firstReturn.body.id,
          instructions: 'x',
          followUpDate: '2026-12-05',
        })
        .expect(201);
      const signed2 = await request(app.getHttpServer())
        .post(`/care-plans/${carePlan2.body.id}/sign`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(201);
      const secondTaskId = signed2.body.careTask.id as string;

      // Now the episode has >=1 COMPLETED Assessment (close-eligible) and a
      // second OPEN generic follow-up CareTask on it (Return-eligible) —
      // race close() against a Return Encounter using that second task.
      const [closeRes, returnRes] = await Promise.all([
        request(app.getHttpServer())
          .post(`/care-episodes/${episodeId}/close`)
          .set('Authorization', `Bearer ${doctorToken}`),
        createReturn(doctorToken, secondTaskId),
      ]);

      // Never both succeed with the Return Encounter landing in a CLOSED
      // episode: if close committed, the Return attempt must have been
      // rejected (409); if the Return committed, the episode must still be
      // ACTIVE at the time it did (close must have been the one rejected).
      const episodeAfter = await prisma.careEpisode.findUniqueOrThrow({
        where: { id: episodeId },
      });
      if (closeRes.status === 201) {
        expect(episodeAfter.status).toBe(CareEpisodeStatus.CLOSED);
        expect(returnRes.status).toBe(409);
      } else {
        expect(closeRes.status).toBe(409);
        expect(returnRes.status).toBe(201);
        expect(episodeAfter.status).toBe(CareEpisodeStatus.ACTIVE);
      }
      // Exactly one of the two racing intents committed.
      const successCount = [closeRes.status, returnRes.status].filter(
        (s) => s === 201,
      ).length;
      expect(successCount).toBe(1);
    });

    it('C4 — rollback proof: a forced failure late in the Return Encounter transaction leaves no orphan episode/encounter/history, and the CareTask remains OPEN', async () => {
      const partialEventActions = [
        'CARE_EPISODE_STARTED',
        'ENCOUNTER_CREATED',
        'CARE_TASK_COMPLETED',
      ] as const;

      const patient = await createPatient('C4');
      const careTaskId = await readyOpenFollowUpTask(patient);

      // T4 source review correction: the three transactional audit events
      // use three DIFFERENT entityIds (CareEpisode id / Encounter id /
      // CareTask id) — the CareEpisode and Encounter ids are never known
      // here because the rolled-back attempt never returns them (the
      // request response is a 500 with no created-resource body). A single
      // entityId filter therefore cannot prove "no partial AuditEvents" for
      // all three action types. Instead, take an authoritative before/after
      // COUNT snapshot per action, tenant-scoped, taken immediately around
      // the single injected-failure call (this test runs `--runInBand`, so
      // nothing else can concurrently write these same tenant-scoped
      // actions in between) — any partial commit from the failed attempt
      // would show up as a nonzero delta on at least one of the three.
      const beforeCounts = await Promise.all(
        partialEventActions.map((action) =>
          prisma.auditEvent.count({ where: { tenantId, action } }),
        ),
      );

      const originalRecord = auditService.record.bind(auditService);
      const recordSpy = jest
        .spyOn(auditService, 'record')
        .mockImplementation(async (input, client) => {
          if (input.action === 'CARE_TASK_COMPLETED') {
            throw new Error('C4 injected failure (test-only, synthetic)');
          }
          return originalRecord(input, client);
        });

      const res = await createReturn(doctorToken, careTaskId);
      expect(res.status).toBe(500);

      recordSpy.mockRestore();

      const afterCounts = await Promise.all(
        partialEventActions.map((action) =>
          prisma.auditEvent.count({ where: { tenantId, action } }),
        ),
      );
      expect(afterCounts).toEqual(beforeCounts);

      const episodes = await prisma.careEpisode.findMany({
        where: { tenantId, patientId: patient, episodeType: 'HEMORRHOID_TREATMENT' },
      });
      // DEC-020: this is a first-ever Return, so the failed transaction would
      // have created the episode too — it must roll back with everything else.
      expect(episodes).toHaveLength(0);

      const returnEncounters = await prisma.encounter.count({
        where: { tenantId, patientId: patient, episodeId: { not: null }, workflowKind: null, treatmentPathwayId: null },
      });
      expect(returnEncounters).toBe(0);

      const historyCount = await prisma.clinicianAssignmentHistory.count({
        where: { tenantId, encounter: { patientId: patient } },
      });
      // Only the initial (non-Return) Encounter's initial-assignment row
      // should exist — none from the rolled-back Return attempt.
      const initialEncounterCount = await prisma.encounter.count({
        where: { tenantId, patientId: patient },
      });
      expect(historyCount).toBe(initialEncounterCount);

      const task = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskId },
      });
      expect(task.status).toBe(CareTaskStatus.OPEN);
      expect(task.completedByEncounterId).toBeNull();
    });
  });
});
