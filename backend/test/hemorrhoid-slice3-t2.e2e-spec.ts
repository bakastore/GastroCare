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

/**
 * Hemorrhoid Vertical Slice 3 — T2 atomic Return Encounter orchestration
 * (e2e), DEC-013 OWNER LOCKED,
 * docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §H-§K.
 *
 * T2 scope only: `POST /encounters/hemorrhoid-return` single-request
 * correctness (episode create-on-first-use, episode reuse, CareTask
 * eligibility, guarded completion, required audit events). The C1-C4
 * real-Postgres concurrency race proof and the mandatory Independent Codex
 * audit for this transaction are T4 — not exercised here.
 */
describe('Hemorrhoid Vertical Slice 3 — T2 atomic Return Encounter orchestration (e2e)', () => {
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
    episodeId?: string,
    reasonForVisit = 'Khám trĩ (synthetic, T2)',
    initial = false,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient,
        episodeId,
        workflowKind: initial ? 'HEMORRHOID_INITIAL' : undefined,
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

  /** Initial branch, through to a signed CarePlan with one OPEN generic
   * follow-up CareTask — the eligible input for the dedicated Return
   * Encounter endpoint. */
  async function readyOpenFollowUpTask(patient: string): Promise<string> {
    const encounterId = await createEncounter(doctorToken, patient, undefined, undefined, true);
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
    // DEC-021 R9 finding 1 — the HEMORRHOID_TREATMENT episode is established
    // by Structured Treatment Activation (v3 decision), NOT by the first
    // Return. The Initial Encounter now owns the ACTIVE episode.
    await activateHemorrhoidTreatment(app, doctorToken, encounterId);

    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId,
        instructions: 'x',
        followUpDate: '2026-11-01',
      })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return signed.body.careTask.id as string;
  }

  async function createReturn(
    token: string,
    careTaskId: string,
    reasonForVisit = 'Tái khám (T2, synthetic)',
  ) {
    return request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${token}`)
      .send({
        careTaskId,
        occurredAt: new Date().toISOString(),
        reasonForVisit,
      });
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
      data: { name: 'Hemorrhoid Slice3 T2 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T2-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t2-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T2 Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t2 patient',
        dateOfBirth: new Date('1971-01-01'),
        gender: 'MALE',
        phone: 'T2-SYNTH-PATIENT-01',
        normalizedPhone: 'T2-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    doctorToken = await login(
      'doctor-t2-slice3@gastrocare.test',
      doctorPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('DEC-021: the first Return Encounter REUSES the ACTIVE episode established by Structured Treatment Activation (never creates one), completes the CareTask, and records audit events', async () => {
    const careTaskId = await readyOpenFollowUpTask(patientId);
    // readyOpenFollowUpTask now activates treatment, so exactly one ACTIVE
    // HEMORRHOID_TREATMENT episode already exists, owned by the Initial
    // Encounter (DEC-021 §5.6 Scenario B / D20-02 supersession).
    const preExisting = await prisma.careEpisode.findFirstOrThrow({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(preExisting.status).toBe(CareEpisodeStatus.ACTIVE);

    const res = await createReturn(doctorToken, careTaskId);
    expect(res.status).toBe(201);
    const encounter = res.body;
    expect(encounter.patientId).toBe(patientId);
    // DEC-021 R9 finding 1 — the Return reuses the pre-existing ACTIVE
    // episode; it does not create a new one, and startedAt is unchanged.
    expect(encounter.episodeId).toBe(preExisting.id);

    const episode = await prisma.careEpisode.findUniqueOrThrow({
      where: { id: encounter.episodeId },
    });
    expect(episode.status).toBe(CareEpisodeStatus.ACTIVE);
    expect(episode.startedAt.toISOString()).toBe(
      preExisting.startedAt.toISOString(),
    );
    expect(
      await prisma.careEpisode.count({
        where: { patientId, episodeType: 'HEMORRHOID_TREATMENT' },
      }),
    ).toBe(1);

    const task = await prisma.careTask.findUniqueOrThrow({
      where: { id: careTaskId },
    });
    expect(task.status).toBe(CareTaskStatus.COMPLETED);
    expect(task.completedByEncounterId).toBe(encounter.id);

    const history = await prisma.clinicianAssignmentHistory.findFirst({
      where: { encounterId: encounter.id },
    });
    expect(history).toBeTruthy();

    // The Return endpoint no longer emits CARE_EPISODE_STARTED (no episode
    // create/reopen). It only records the Return Encounter + task completion.
    const events = await prisma.auditEvent.findMany({
      where: { tenantId, entityId: { in: [encounter.id, task.id] } },
    });
    const actions = events.map((e) => e.action).sort();
    expect(actions).toEqual(
      ['CARE_TASK_COMPLETED', 'CARE_TASK_CREATED', 'ENCOUNTER_CREATED'].sort(),
    );
  });

  it('reuses the same ACTIVE HEMORRHOID_TREATMENT episode for a second Return Encounter without changing startedAt', async () => {
    const firstTaskId = await readyOpenFollowUpTask(patientId);
    const firstReturn = await createReturn(doctorToken, firstTaskId);
    expect(firstReturn.status).toBe(201);
    const episodeId = firstReturn.body.episodeId as string;
    const episodeBefore = await prisma.careEpisode.findUniqueOrThrow({
      where: { id: episodeId },
    });

    // Continuous-care branch: Assessment -> Next Decision -> new CarePlan on
    // the Return Encounter -> sign -> a second OPEN generic follow-up task.
    const assessment = await createSubmission(
      doctorToken,
      firstReturn.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);
    const decision = await createSubmission(
      doctorToken,
      firstReturn.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    await completeSubmission(doctorToken, decision.body.id);
    const carePlan2 = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId: firstReturn.body.id,
        instructions: 'x',
        followUpDate: '2026-12-01',
      })
      .expect(201);
    const signed2 = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan2.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    const secondTaskId = signed2.body.careTask.id as string;

    const secondReturn = await createReturn(doctorToken, secondTaskId);
    expect(secondReturn.status).toBe(201);
    expect(secondReturn.body.episodeId).toBe(episodeId);

    const episodeAfter = await prisma.careEpisode.findUniqueOrThrow({
      where: { id: episodeId },
    });
    expect(episodeAfter.startedAt.toISOString()).toBe(
      episodeBefore.startedAt.toISOString(),
    );

    const episodeCount = await prisma.careEpisode.count({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(episodeCount).toBe(1);
  });

  it('rejects a CareTask that is not OPEN (already completed)', async () => {
    const careTaskId = await readyOpenFollowUpTask(patientId);
    const first = await createReturn(doctorToken, careTaskId);
    expect(first.status).toBe(201);

    const second = await createReturn(doctorToken, careTaskId);
    expect(second.status).toBe(409);
  });

  it('rejects a CareTask with timepointCode set (a Longo scheduled task, not a generic Hemorrhoid follow-up)', async () => {
    const careTaskId = await readyOpenFollowUpTask(patientId);
    await prisma.careTask.update({
      where: { id: careTaskId },
      data: { timepointCode: 'TWO_WEEK' },
    });
    const res = await createReturn(doctorToken, careTaskId);
    expect(res.status).toBe(409);
  });

  it('rejects a CareTask with no linked CarePlan', async () => {
    const orphanTask = await prisma.careTask.create({
      data: {
        tenantId,
        patientId,
        dueDate: new Date('2026-11-01'),
      },
    });
    const res = await createReturn(doctorToken, orphanTask.id);
    expect(res.status).toBe(409);
  });

  it('rejects an unknown careTaskId with 404', async () => {
    const res = await createReturn(
      doctorToken,
      '00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(404);
  });

  it('does not accept patientId, episodeId, clinicalNote, or assessment from the client', async () => {
    const careTaskId = await readyOpenFollowUpTask(patientId);
    const res = await request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        careTaskId,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'x',
        patientId: 'attacker-supplied-patient-id',
        episodeId: 'attacker-supplied-episode-id',
        clinicalNote: 'attacker-supplied-note',
        assessment: 'attacker-supplied-assessment',
      });
    expect(res.status).toBe(201);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.clinicalNote).toBe('');
    expect(res.body.assessment).toBe('');
  });
});
