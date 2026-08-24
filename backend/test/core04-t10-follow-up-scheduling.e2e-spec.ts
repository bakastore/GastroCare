import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-04 T10 — Follow-up Scheduling (e2e).
 *
 * Covers: idempotent generation triggered by LONGO_INTRAOP_RECORD
 * completion, the surgery-Encounter-occurredAt-only anchor, deterministic
 * TWO_WEEK/MONTH_1/MONTH_3/MONTH_6 completion matching scoped to the same
 * Episode, no CareTask.episodeId column exposed, no auto-close of Episode,
 * and audited reschedule. Synthetic data only.
 */
describe('CORE-04 T10 — Follow-up Scheduling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;

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

  async function createPatient(suffix: string) {
    const res = await prisma.patient.create({
      data: {
        tenantId,
        fullName: `Synthetic T10 Patient ${suffix}`,
        normalizedFullName: `synthetic t10 patient ${suffix}`.toLowerCase(),
        dateOfBirth: new Date('1970-01-01'),
        gender: 'MALE',
        phone: `090000070${suffix}`,
        normalizedPhone: `090000070${suffix}`,
      },
    });
    return res.id;
  }

  async function startEpisode(patientId: string, startedAt: string) {
    const res = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ patientId, episodeType: 'LONGO_TREATMENT', startedAt })
      .expect(201);
    return res.body.id as string;
  }

  async function createEncounter(
    patientId: string,
    episodeId: string,
    occurredAt: string,
    reasonForVisit: string,
  ) {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        occurredAt,
        reasonForVisit,
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);
    return res.body.id as string;
  }

  async function createAndCompleteSubmission(
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown>,
  ) {
    const createRes = await request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId, templateKey, responses })
      .expect(201);
    const submissionId = createRes.body.id as string;
    const completeRes = await request(app.getHttpServer())
      .post(`/clinical-forms/${submissionId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);
    return completeRes.body;
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
      data: { name: 'CORE-04 T10 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Core04T10-Doctor-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor@core04-t10.example.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });
    doctorToken = await login('doctor@core04-t10.example.test', doctorPassword);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  describe('A. Completing LONGO_INTRAOP_RECORD generates exactly 4 tasks, anchored on surgery occurredAt', () => {
    let patientId: string;
    let episodeId: string;
    let surgeryEncounterId: string;
    const surgeryOccurredAt = '2026-01-10T07:00:00.000Z';

    it('setup: episode + surgery encounter + completed intraop record', async () => {
      patientId = await createPatient('A');
      episodeId = await startEpisode(patientId, '2026-01-01T02:00:00.000Z');
      surgeryEncounterId = await createEncounter(
        patientId,
        episodeId,
        surgeryOccurredAt,
        'Phẫu thuật Longo (dữ liệu giả lập)',
      );
      const completed = await createAndCompleteSubmission(
        surgeryEncounterId,
        'LONGO_INTRAOP_RECORD',
        { operativeDurationMinutes: 40, bloodLossMl: 20 },
      );
      expect(completed.status).toBe('COMPLETED');
    });

    it('exactly 4 CareTasks exist, one per timepoint, dueDate derived from surgery occurredAt', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/follow-up-tasks?sourceEncounterId=${surgeryEncounterId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      const tasks = listRes.body as Array<{
        timepointCode: string;
        dueDate: string;
        status: string;
        carePlanId: string | null;
      }>;
      expect(tasks).toHaveLength(4);
      expect(tasks.map((t) => t.timepointCode).sort()).toEqual(
        ['MONTH_1', 'MONTH_3', 'MONTH_6', 'TWO_WEEK'].sort(),
      );
      for (const task of tasks) {
        expect(task.status).toBe('OPEN');
        expect(task.carePlanId).toBeNull();
        expect(new Date(task.dueDate).getTime()).toBeGreaterThan(
          new Date(surgeryOccurredAt).getTime(),
        );
      }
    });

    it('no CareTask row exposes an episodeId field', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/follow-up-tasks?sourceEncounterId=${surgeryEncounterId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      for (const task of listRes.body as Record<string, unknown>[]) {
        expect(Object.prototype.hasOwnProperty.call(task, 'episodeId')).toBe(
          false,
        );
      }
    });

    it('re-triggering generation explicitly is idempotent — still exactly 4 tasks, same ids', async () => {
      const before = await request(app.getHttpServer())
        .get(`/follow-up-tasks?sourceEncounterId=${surgeryEncounterId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      const beforeIds = (before.body as Array<{ id: string }>)
        .map((t) => t.id)
        .sort();

      const genRes = await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(201);
      expect(genRes.body).toHaveLength(4);

      const after = await request(app.getHttpServer())
        .get(`/follow-up-tasks?sourceEncounterId=${surgeryEncounterId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
      const afterIds = (after.body as Array<{ id: string }>)
        .map((t) => t.id)
        .sort();
      expect(afterIds).toEqual(beforeIds);
    });

    it('concurrent duplicate generate calls do not create duplicate tasks (negative/concurrency check)', async () => {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/follow-up-tasks/generate')
            .set('Authorization', `Bearer ${doctorToken}`)
            .send({ sourceEncounterId: surgeryEncounterId }),
        ),
      );
      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryEncounterId },
      });
      expect(tasks).toHaveLength(4);
    });

    it('deterministic matching: completing LONGO_TWO_WEEK_FOLLOWUP on an Encounter of the SAME Episode completes only the TWO_WEEK task', async () => {
      const twoWeekEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-01-24T02:00:00.000Z',
        'Tái khám 2 tuần (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(
        twoWeekEncounterId,
        'LONGO_TWO_WEEK_FOLLOWUP',
        { twoWeekPainVas: 2 },
      );

      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryEncounterId },
      });
      const twoWeek = tasks.find((t) => t.timepointCode === 'TWO_WEEK');
      const others = tasks.filter((t) => t.timepointCode !== 'TWO_WEEK');
      expect(twoWeek?.status).toBe('COMPLETED');
      expect(twoWeek?.completedByEncounterId).toBe(twoWeekEncounterId);
      for (const other of others) {
        expect(other.status).toBe('OPEN');
      }
    });

    it('deterministic matching: MONTH_1 LONGO_LONG_TERM_FOLLOWUP completes only the MONTH_1 task, not MONTH_3/MONTH_6', async () => {
      const month1EncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-02-10T02:00:00.000Z',
        'Tái khám tháng 1 (dữ liệu giả lập)',
      );
      const wexnerFull = {
        longTermSolidStool: 0,
        longTermLiquidStool: 0,
        longTermGas: 0,
        longTermPadWearing: 0,
        longTermLifestyleAlteration: 0,
      };
      await createAndCompleteSubmission(
        month1EncounterId,
        'LONGO_LONG_TERM_FOLLOWUP',
        { plannedTimepoint: 'MONTH_1', ...wexnerFull },
      );

      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryEncounterId },
      });
      const month1 = tasks.find((t) => t.timepointCode === 'MONTH_1');
      const month3 = tasks.find((t) => t.timepointCode === 'MONTH_3');
      const month6 = tasks.find((t) => t.timepointCode === 'MONTH_6');
      expect(month1?.status).toBe('COMPLETED');
      expect(month1?.completedByEncounterId).toBe(month1EncounterId);
      expect(month3?.status).toBe('OPEN');
      expect(month6?.status).toBe('OPEN');
    });

    it('the Episode is NOT auto-closed by follow-up task completion', async () => {
      const episode = await prisma.careEpisode.findUniqueOrThrow({
        where: { id: episodeId },
      });
      expect(episode.status).toBe('ACTIVE');
    });

    it('reschedule updates dueDate and records an audit event', async () => {
      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryEncounterId, timepointCode: 'MONTH_3' },
      });
      const taskId = tasks[0].id;
      const newDueDate = '2026-05-01T00:00:00.000Z';

      await request(app.getHttpServer())
        .patch(`/follow-up-tasks/${taskId}/reschedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ dueDate: newDueDate })
        .expect(200);

      const updated = await prisma.careTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(updated.dueDate.toISOString()).toBe(newDueDate);

      const auditEvent = await prisma.auditEvent.findFirst({
        where: { tenantId, entityType: 'CareTask', entityId: taskId, action: 'CARE_TASK_RESCHEDULED' },
      });
      expect(auditEvent).not.toBeNull();
    });
  });

  describe('B. Cross-Episode isolation: completing a follow-up form under a DIFFERENT Episode never completes another Episode\'s task', () => {
    it('a second, unrelated Episode with its own surgery/TWO_WEEK does not touch the first Episode\'s tasks', async () => {
      const patientB = await createPatient('B');
      const episodeB = await startEpisode(patientB, '2026-03-01T02:00:00.000Z');
      const surgeryB = await createEncounter(
        patientB,
        episodeB,
        '2026-03-05T07:00:00.000Z',
        'Phẫu thuật Longo B (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryB, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 50,
      });

      const patientA = await createPatient('A2');
      const episodeA = await startEpisode(patientA, '2026-03-01T02:00:00.000Z');
      const surgeryA = await createEncounter(
        patientA,
        episodeA,
        '2026-03-06T07:00:00.000Z',
        'Phẫu thuật Longo A (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryA, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 55,
      });

      // Complete TWO_WEEK under Episode A only.
      const twoWeekA = await createEncounter(
        patientA,
        episodeA,
        '2026-03-20T02:00:00.000Z',
        'Tái khám 2 tuần A (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(twoWeekA, 'LONGO_TWO_WEEK_FOLLOWUP', {
        twoWeekPainVas: 0,
      });

      const tasksB = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryB },
      });
      expect(tasksB.every((t) => t.status === 'OPEN')).toBe(true);

      const tasksA = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: surgeryA },
      });
      const twoWeekTaskA = tasksA.find((t) => t.timepointCode === 'TWO_WEEK');
      expect(twoWeekTaskA?.status).toBe('COMPLETED');
    });
  });

  describe('H. T16 remediation R2 — explicit Longo surgery anchor enforced on manual generation', () => {
    let otherTenantId: string;
    let otherDoctorToken: string;

    beforeAll(async () => {
      const otherTenant = await prisma.tenant.create({
        data: { name: 'CORE-04 T10 R2 Other Tenant' },
      });
      otherTenantId = otherTenant.id;
      const otherDoctorPassword = 'Core04T10R2-Doctor-Pass1!';
      await prisma.authUser.create({
        data: {
          email: 'doctor@core04-t10-r2.example.test',
          passwordHash: await bcrypt.hash(otherDoctorPassword, 10),
          role: AuthRole.DOCTOR,
          tenantId: otherTenantId,
        },
      });
      otherDoctorToken = await login(
        'doctor@core04-t10-r2.example.test',
        otherDoctorPassword,
      );
    });

    it('valid surgery Encounter (same tenant, correct patient ancestry, LONGO_TREATMENT episode, completed intraop) -> PASS', async () => {
      const patientId = await createPatient('H1');
      const episodeId = await startEpisode(patientId, '2026-06-01T02:00:00.000Z');
      const surgeryEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-06-05T07:00:00.000Z',
        'Phẫu thuật Longo H1 (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryEncounterId, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 45,
      });

      const res = await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(201);
      expect(res.body).toHaveLength(4);
    });

    it('non-Longo Encounter (no CareEpisode at all) -> REJECT', async () => {
      const patientId = await createPatient('H2');
      const res = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          occurredAt: '2026-06-06T02:00:00.000Z',
          reasonForVisit: 'Synthetic non-Longo encounter',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);
      const ungroupedEncounterId = res.body.id as string;

      await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: ungroupedEncounterId })
        .expect(403);

      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: ungroupedEncounterId },
      });
      expect(tasks).toHaveLength(0);
    });

    it('Longo episode WITHOUT a completed LONGO_INTRAOP_RECORD on the given Encounter -> REJECT', async () => {
      const patientId = await createPatient('H3');
      const episodeId = await startEpisode(patientId, '2026-06-07T02:00:00.000Z');
      const preopEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-06-07T07:00:00.000Z',
        'Khám tiền phẫu H3 (dữ liệu giả lập)',
      );
      // No LONGO_INTRAOP_RECORD submission at all on this Encounter — it is
      // not a valid surgery milestone even though it belongs to a real
      // LONGO_TREATMENT episode.
      await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: preopEncounterId })
        .expect(403);

      const tasks = await prisma.careTask.findMany({
        where: { tenantId, sourceEncounterId: preopEncounterId },
      });
      expect(tasks).toHaveLength(0);
    });

    it('wrong patient ancestry (episode belongs to a different patient than the Encounter) -> REJECT', async () => {
      const patientId = await createPatient('H4');
      const otherPatientId = await createPatient('H4-other');
      const episodeId = await startEpisode(patientId, '2026-06-08T02:00:00.000Z');
      const surgeryEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-06-08T07:00:00.000Z',
        'Phẫu thuật Longo H4 (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryEncounterId, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 45,
      });

      // Directly corrupt the Encounter's patientId at the data layer to
      // simulate a mismatched-ancestry row (the API itself has no update
      // path for this field, so this proves the service-level guard, not
      // just a DTO-level one).
      await prisma.encounter.update({
        where: { id: surgeryEncounterId },
        data: { patientId: otherPatientId },
      });

      await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(403);
    });

    it('wrong tenant (Encounter belongs to a different tenant) -> REJECT (not found)', async () => {
      const patientId = await createPatient('H5');
      const episodeId = await startEpisode(patientId, '2026-06-09T02:00:00.000Z');
      const surgeryEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-06-09T07:00:00.000Z',
        'Phẫu thuật Longo H5 (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryEncounterId, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 45,
      });

      await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(404);

      const tasks = await prisma.careTask.findMany({
        where: { tenantId: otherTenantId, sourceEncounterId: surgeryEncounterId },
      });
      expect(tasks).toHaveLength(0);
    });

    it('repeated generation after a valid anchor remains idempotent', async () => {
      const patientId = await createPatient('H6');
      const episodeId = await startEpisode(patientId, '2026-06-10T02:00:00.000Z');
      const surgeryEncounterId = await createEncounter(
        patientId,
        episodeId,
        '2026-06-10T07:00:00.000Z',
        'Phẫu thuật Longo H6 (dữ liệu giả lập)',
      );
      await createAndCompleteSubmission(surgeryEncounterId, 'LONGO_INTRAOP_RECORD', {
        operativeDurationMinutes: 45,
      });

      const first = await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/follow-up-tasks/generate')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ sourceEncounterId: surgeryEncounterId })
        .expect(201);

      expect(first.body).toHaveLength(4);
      expect(
        (second.body as Array<{ id: string }>).map((t) => t.id).sort(),
      ).toEqual((first.body as Array<{ id: string }>).map((t) => t.id).sort());
    });
  });
});
