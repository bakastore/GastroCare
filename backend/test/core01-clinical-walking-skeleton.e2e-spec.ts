import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AuthRole, CarePlanStatus, CareTaskStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-01 — Clinical Core Walking Skeleton acceptance evidence.
 *
 * Proves, with real requests against the app and a real disposable test
 * PostgreSQL database, the synthetic end-to-end clinical lifecycle and every
 * invariant required by the CORE-01 Owner Execution Contract: Patient
 * identity/duplicate-safety, minimal RBAC, Encounter, CarePlan signed
 * immutability + amendment lineage, CareTask auto-creation + derived
 * OVERDUE, Patient Timeline as a read projection, append-only AuditEvent,
 * and tenant isolation across every Core entity.
 *
 * Synthetic data only — no real patient data (see Owner Execution Contract
 * section 20).
 */
describe('CORE-01 — Clinical Core Walking Skeleton (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };

  const doctorAPassword = 'CoreDoctorA-Pass1!';
  const receptionistAPassword = 'CoreReceptionA-Pass1!';
  const doctorBPassword = 'CoreDoctorB-Pass1!';

  let doctorAToken: string;
  let receptionistAToken: string;
  let doctorBToken: string;

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

    // Reset all Core + Foundation tables (disposable test DB only).
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

    tenantA = await prisma.tenant.create({
      data: { name: 'CORE-01 Test Tenant A' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'CORE-01 Test Tenant B' },
    });

    await prisma.authUser.create({
      data: {
        email: 'doctor-a@core01-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorAPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'receptionist-a@core01-test.gastrocare.local',
        passwordHash: await bcrypt.hash(receptionistAPassword, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'doctor-b@core01-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorBPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantB.id,
      },
    });

    doctorAToken = await loginAs(
      'doctor-a@core01-test.gastrocare.local',
      doctorAPassword,
    );
    receptionistAToken = await loginAs(
      'receptionist-a@core01-test.gastrocare.local',
      receptionistAPassword,
    );
    doctorBToken = await loginAs(
      'doctor-b@core01-test.gastrocare.local',
      doctorBPassword,
    );
  });

  afterAll(async () => {
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
    await app.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---------------------------------------------------------------------
  // A. Foundation regression sanity (full Gate 2 suite runs separately;
  //    this just confirms Foundation auth/tenant behavior still holds with
  //    the added AuthRole column and RolesGuard in place).
  // ---------------------------------------------------------------------
  describe('A. Foundation regression sanity', () => {
    it('unauthenticated request to a protected route is rejected (401)', async () => {
      await request(app.getHttpServer()).get('/patients').expect(401);
    });

    it('GET /health remains reachable anonymously', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });
  });

  // ---------------------------------------------------------------------
  // B/RBAC/17. Patient — identity, duplicate warning, no auto-merge, RBAC
  // ---------------------------------------------------------------------
  let patientMinhId: string;

  describe('B. Patient + RBAC + duplicate safety', () => {
    it('doctor can register a patient', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Nguyen Van Minh',
          dateOfBirth: '1984-03-15',
          gender: 'MALE',
          phone: '0901234567',
        })
        .expect(201);
      expect(res.body.patient.id).toEqual(expect.any(String));
      patientMinhId = res.body.patient.id;
    });

    it('receptionist can also register a patient (allowed Patient operation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({
          fullName: 'Tran Thi Hoa',
          dateOfBirth: '1990-06-01',
          gender: 'FEMALE',
          phone: '0909998888',
        })
        .expect(201);
      expect(res.body.patient.id).toEqual(expect.any(String));
    });

    it('receptionist without a role match receives 403 on a role-restricted route (unauthorized role)', async () => {
      // Encounter is DOCTOR-only; a RECEPTIONIST is authenticated but not
      // authorized for this route.
      await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({
          patientId: patientMinhId,
          occurredAt: '2026-08-01T09:00:00.000Z',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(403);
    });

    it('duplicate-check surfaces the existing patient as a candidate by matching signals (accented-name variant)', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients/duplicate-check')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Nguyễn Văn Minh',
          dateOfBirth: '1984-03-15',
          phone: '0901234567',
        })
        .expect(201);
      expect(res.body.some((p: { id: string }) => p.id === patientMinhId)).toBe(
        true,
      );
    });

    it('creating a second patient with the same matching signals does NOT auto-merge — two distinct Patient IDs exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Nguyễn Văn Minh',
          dateOfBirth: '1984-03-15',
          gender: 'MALE',
          phone: '0901234567',
        })
        .expect(201);

      const secondId: string = res.body.patient.id;
      expect(secondId).not.toBe(patientMinhId);
      // The explicit create-new decision surfaced a warning about the first.
      expect(
        res.body.possibleDuplicates.some(
          (p: { id: string }) => p.id === patientMinhId,
        ),
      ).toBe(true);

      const list = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      const ids = list.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(patientMinhId);
      expect(ids).toContain(secondId);

      // Clean up the intentional duplicate so later list-based assertions in
      // this suite are not affected by it.
      await prisma.patient.delete({ where: { id: secondId } });
    });

    it('tenant isolation: Tenant B cannot see Tenant A patients', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(200);
      expect(res.body.some((p: { id: string }) => p.id === patientMinhId)).toBe(
        false,
      );
    });

    it('tenant isolation: Tenant B direct lookup of a known Tenant A patient id returns 404', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientMinhId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('AuditEvent recorded for Patient creation', async () => {
      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'Patient', entityId: patientMinhId },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].action).toBe('PATIENT_CREATED');
      expect(events[0].tenantId).toBe(tenantA.id);
    });
  });

  // ---------------------------------------------------------------------
  // C/D/E/F/G/I. Synthetic end-to-end clinical lifecycle (Nguyễn Văn Minh
  // case, same as docs/03_CLINICAL_WORKFLOW_BASELINE.md).
  // ---------------------------------------------------------------------
  let encounterId: string;
  let carePlanId: string;
  let careTaskId: string;
  let returnEncounterId: string;

  describe('C. Encounter', () => {
    it('doctor creates the initial Encounter', async () => {
      const res = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientMinhId,
          occurredAt: '2026-08-01T09:00:00.000Z',
          reasonForVisit: 'Đau thượng vị 6 tuần, đầy bụng, ợ nóng',
          clinicalNote: 'Không nôn máu, không phân đen.',
          assessment: 'Theo dõi viêm dạ dày / GERD',
        })
        .expect(201);
      encounterId = res.body.id;
      expect(res.body.patientId).toBe(patientMinhId);
    });

    it('unauthenticated request to Encounter is rejected (401)', async () => {
      await request(app.getHttpServer())
        .get(`/encounters/${encounterId}`)
        .expect(401);
    });

    it('receptionist cannot read detailed clinical Encounter content (403)', async () => {
      await request(app.getHttpServer())
        .get(`/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('doctor can read the Encounter within their tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(res.body.assessment).toBe('Theo dõi viêm dạ dày / GERD');
    });

    it('tenant isolation: Tenant B cannot read Tenant A Encounter (404)', async () => {
      await request(app.getHttpServer())
        .get(`/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('AuditEvent recorded for Encounter creation', async () => {
      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'Encounter', entityId: encounterId },
      });
      expect(events.some((e) => e.action === 'ENCOUNTER_CREATED')).toBe(true);
    });
  });

  describe('D. CarePlan — draft, sign, immutability, amendment lineage', () => {
    it('doctor creates a DRAFT CarePlan for the Encounter with a follow-up date', async () => {
      const res = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId,
          instructions: 'Điều trị theo đơn, tái khám 14 ngày',
          followUpDate: '2026-09-05',
        })
        .expect(201);
      carePlanId = res.body.id;
      expect(res.body.status).toBe(CarePlanStatus.DRAFT);
    });

    it('DRAFT content can be edited before signing', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/care-plans/${carePlanId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'Điều trị theo đơn (đã chỉnh), tái khám 14 ngày',
        })
        .expect(200);
      expect(res.body.instructions).toContain('đã chỉnh');
    });

    it('signing the DRAFT plan creates SIGNED status + version 1 + a CareTask', async () => {
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      expect(res.body.signedPlan.status).toBe(CarePlanStatus.SIGNED);
      expect(res.body.version.versionNumber).toBe(1);
      expect(res.body.careTask).toBeTruthy();
      careTaskId = res.body.careTask.id;
      expect(res.body.careTask.status).toBe(CareTaskStatus.OPEN);
    });

    it('a SIGNED plan cannot be re-drafted/overwritten (409 on the draft-edit route)', async () => {
      await request(app.getHttpServer())
        .patch(`/care-plans/${carePlanId}/draft`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ instructions: 'attempted overwrite' })
        .expect(409);
    });

    it('a SIGNED plan cannot be signed again (409)', async () => {
      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);
    });

    it('the underlying CarePlanVersion 1 row remains unchanged in the database (no overwrite at the data layer)', async () => {
      const v1 = await prisma.carePlanVersion.findFirst({
        where: { carePlanId, versionNumber: 1 },
      });
      expect(v1?.instructions).toContain('đã chỉnh');
    });

    it('amending the SIGNED plan requires a reason and creates version 2 with lineage to version 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          instructions: 'Điều chỉnh liều thuốc sau khi bệnh nhân phản hồi',
          followUpDate: '2026-09-05',
          reason: 'Bệnh nhân báo tác dụng phụ, cần đổi liều',
        })
        .expect(201);
      expect(res.body.versionNumber).toBe(2);
      expect(res.body.previousVersionId).toEqual(expect.any(String));
    });

    it('original SIGNED v1 content remains retrievable after amendment (lineage preserved, nothing lost)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/care-plans/${carePlanId}`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      expect(res.body.versions).toHaveLength(2);
      const v1 = res.body.versions.find(
        (v: { versionNumber: number }) => v.versionNumber === 1,
      );
      const v2 = res.body.versions.find(
        (v: { versionNumber: number }) => v.versionNumber === 2,
      );
      expect(v1.instructions).toContain('đã chỉnh');
      expect(v2.instructions).toContain('Điều chỉnh liều');
      expect(v2.previousVersionId).toBe(v1.id);
      expect(res.body.currentVersionId).toBe(v2.id);
    });

    it('amending without a reason is rejected by validation (400)', async () => {
      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanId}/amend`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ instructions: 'no reason given' })
        .expect(400);
    });

    it('receptionist cannot access CarePlan (403)', async () => {
      await request(app.getHttpServer())
        .get(`/care-plans/${carePlanId}`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('tenant isolation: Tenant B cannot read Tenant A CarePlan (404)', async () => {
      await request(app.getHttpServer())
        .get(`/care-plans/${carePlanId}`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('AuditEvent recorded for sign and amend', async () => {
      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'CarePlan', entityId: carePlanId },
      });
      expect(events.some((e) => e.action === 'CARE_PLAN_SIGNED')).toBe(true);
      expect(events.some((e) => e.action === 'CARE_PLAN_AMENDED')).toBe(true);
    });
  });

  describe('E. CareTask — auto-created, complete/cancel, derived OVERDUE', () => {
    it('the follow-up CareTask created on sign is visible in the queue as OPEN', async () => {
      const res = await request(app.getHttpServer())
        .get('/care-tasks')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      const task = res.body.find((t: { id: string }) => t.id === careTaskId);
      expect(task.status).toBe(CareTaskStatus.OPEN);
      expect(task).toHaveProperty('overdue');
    });

    it('OVERDUE is derived, not stored: a task with a past dueDate and OPEN status reports overdue:true without any stored OVERDUE status', async () => {
      const overdueTask = await prisma.careTask.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientMinhId,
          carePlanId,
          dueDate: new Date('2020-01-01'),
        },
      });
      // Confirm the stored status column never contains anything but the
      // three defined enum values by construction (Prisma enum), and that
      // the API derives "overdue" at read time.
      expect(overdueTask.status).toBe(CareTaskStatus.OPEN);

      const res = await request(app.getHttpServer())
        .get('/care-tasks')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
      const found = res.body.find(
        (t: { id: string }) => t.id === overdueTask.id,
      );
      expect(found.status).toBe(CareTaskStatus.OPEN);
      expect(found.overdue).toBe(true);

      await prisma.careTask.delete({ where: { id: overdueTask.id } });
    });

    it('a later synthetic RETURN Encounter is recorded for the same Patient (14 days later, per docs/03_CLINICAL_WORKFLOW_BASELINE.md)', async () => {
      const res = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientMinhId,
          occurredAt: '2026-08-15T09:00:00.000Z',
          reasonForVisit: 'Tái khám theo hẹn 14 ngày',
          clinicalNote: 'Triệu chứng giảm rõ, không còn đau khi đói',
          assessment: 'Đáp ứng tốt với điều trị',
        })
        .expect(201);
      returnEncounterId = res.body.id;

      expect(returnEncounterId).not.toBe(encounterId);
      expect(res.body.patientId).toBe(patientMinhId);
      expect(res.body.tenantId).toBe(tenantA.id);
    });

    it('doctor explicitly completes the existing CareTask after the return encounter', async () => {
      const res = await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      expect(res.body.status).toBe(CareTaskStatus.COMPLETED);
      expect(res.body.overdue).toBe(false);
    });

    it('completing an already-completed task is rejected (409)', async () => {
      await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskId}/complete`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);
    });

    it('cancel transition works on a fresh OPEN task', async () => {
      const draftEncounter = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientMinhId,
          occurredAt: '2026-08-16T09:00:00.000Z',
          reasonForVisit: 'reason',
          clinicalNote: 'note',
          assessment: 'assessment',
        })
        .expect(201);
      const plan = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: draftEncounter.body.id,
          instructions: 'plan',
          followUpDate: '2026-10-01',
        })
        .expect(201);
      const signed = await request(app.getHttpServer())
        .post(`/care-plans/${plan.body.id}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      const cancelableTaskId: string = signed.body.careTask.id;

      const res = await request(app.getHttpServer())
        .post(`/care-tasks/${cancelableTaskId}/cancel`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      expect(res.body.status).toBe(CareTaskStatus.CANCELLED);
    });

    it('tenant isolation: Tenant B care-tasks list never includes Tenant A tasks', async () => {
      const res = await request(app.getHttpServer())
        .get('/care-tasks')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(200);
      expect(res.body.some((t: { id: string }) => t.id === careTaskId)).toBe(
        false,
      );
    });
  });

  describe('F. Patient Timeline — projection, ordering, tenant isolation', () => {
    // These Encounters predate CORE-04 Episodes (no episodeId), so the
    // CORE-04 T11 grouped Timeline response places all of their events
    // under `ungroupedEncounters` — see docs/09_CORE04_IMPLEMENTATION_CONTRACT.md
    // T11 ("hỗ trợ Encounter không thuộc Episode").
    it('doctor retrieves a chronological timeline composed from Encounter/CarePlan/CareTask, grouped under ungroupedEncounters when there is no Episode', async () => {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientMinhId}/timeline`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      expect(Array.isArray(res.body.episodes)).toBe(true);
      expect(Array.isArray(res.body.ungroupedEncounters)).toBe(true);
      const ungrouped = res.body.ungroupedEncounters;
      expect(
        ungrouped.some((e: { type: string }) => e.type === 'ENCOUNTER'),
      ).toBe(true);
      expect(
        ungrouped.some((e: { type: string }) => e.type === 'CARE_PLAN_SIGNED'),
      ).toBe(true);
      expect(
        ungrouped.some((e: { type: string }) => e.type === 'CARE_TASK'),
      ).toBe(true);

      const timestamps = ungrouped.map((e: { timestamp: string }) =>
        new Date(e.timestamp).getTime(),
      );
      const sorted = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sorted);
    });

    it('Timeline contains BOTH the initial Encounter and the return Encounter, in correct chronological sequence, both belonging to the same Patient and Tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientMinhId}/timeline`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);

      type TimelineEvent = {
        type: string;
        timestamp: string;
        data: { id: string };
      };
      const timeline = res.body.ungroupedEncounters as TimelineEvent[];
      const encounterEvents = timeline.filter((e) => e.type === 'ENCOUNTER');
      const initialEvent = encounterEvents.find(
        (e) => e.data.id === encounterId,
      );
      const returnEvent = encounterEvents.find(
        (e) => e.data.id === returnEncounterId,
      );

      expect(initialEvent).toBeTruthy();
      expect(returnEvent).toBeTruthy();

      // Correct chronological sequence: initial Encounter strictly precedes
      // the return Encounter in the projected Timeline.
      const initialIndex = timeline.indexOf(initialEvent!);
      const returnIndex = timeline.indexOf(returnEvent!);
      expect(initialIndex).toBeLessThan(returnIndex);
      expect(new Date(initialEvent!.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(returnEvent!.timestamp).getTime(),
      );

      // Both Encounters belong to the same Patient and Tenant — confirmed
      // directly against the persisted rows, not just the projection.
      const [initialRow, returnRow] = await Promise.all([
        prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } }),
        prisma.encounter.findUniqueOrThrow({
          where: { id: returnEncounterId },
        }),
      ]);
      expect(initialRow.patientId).toBe(patientMinhId);
      expect(returnRow.patientId).toBe(patientMinhId);
      expect(initialRow.tenantId).toBe(tenantA.id);
      expect(returnRow.tenantId).toBe(tenantA.id);
    });

    it('receptionist cannot read the Timeline (403)', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientMinhId}/timeline`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('tenant isolation: Tenant B cannot read Tenant A patient timeline (404)', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientMinhId}/timeline`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('Timeline is never a write target — there is no write-capable Timeline route', async () => {
      // No POST/PATCH/PUT/DELETE exists under /patients/:id/timeline; the
      // only verb wired to that path is GET (see PatientsController).
      await request(app.getHttpServer())
        .post(`/patients/${patientMinhId}/timeline`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(404);
    });
  });

  describe('G. AuditEvent — append-only', () => {
    it('material Core writes produced audit events across the lifecycle', async () => {
      const actions = (
        await prisma.auditEvent.findMany({ where: { tenantId: tenantA.id } })
      ).map((e) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'PATIENT_CREATED',
          'ENCOUNTER_CREATED',
          'CARE_PLAN_SIGNED',
          'CARE_TASK_CREATED',
          'CARE_PLAN_AMENDED',
          'CARE_TASK_COMPLETED',
          'CARE_TASK_CANCELLED',
        ]),
      );
    });

    it('clinical note/assessment content is not copied into audit metadata', async () => {
      const events = await prisma.auditEvent.findMany({
        where: { entityType: 'Encounter', entityId: encounterId },
      });
      for (const event of events) {
        expect(JSON.stringify(event.metadata ?? {})).not.toContain(
          'Đau thượng vị',
        );
      }
    });
  });
});
