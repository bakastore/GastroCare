import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, ClinicalFormStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 1 (e2e) — DEC-010, OWNER LOCKED.
 *
 * Covers: Facility/Room ancestry + tenant isolation, responsibleClinicianId
 * resolution/assignment, clinician handover provenance/audit/authorization,
 * vital-sign copy-forward (including the deterministic equal-occurredAt
 * tie-break), and HEMORRHOID_EXAMINATION v1 (empty-complete, morphology
 * fields, symptom/observed split, immutability, amendment lineage, Timeline
 * integration). Synthetic data only.
 */
describe('Hemorrhoid Vertical Slice 1 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let patientAId: string;
  let patientBId: string;

  // Configured default-clinician email — set before app bootstrap so
  // ConfigModule picks it up, proving resolution goes through config/lookup
  // rather than a hard-coded literal.
  const defaultClinicianEmail =
    'default-clinician@hemorrhoid-slice1.example.test';

  let doctorA1Id: string; // configured default clinician
  let doctorA1Token: string;
  let doctorA2Id: string; // secondary clinician, handover target
  let doctorA2Token: string;
  let doctorBId: string; // cross-tenant clinician
  let doctorBToken: string;
  let receptionistAToken: string;

  let facilityAId: string;
  let roomAId: string;
  let facilityBId: string;
  let roomBId: string;

  async function resetTables() {
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
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
    body: Record<string, unknown>,
  ) {
    const response = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    return response;
  }

  beforeAll(async () => {
    process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = defaultClinicianEmail;

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

    const tenantA = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice1 Synthetic Tenant A' },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice1 Synthetic Tenant B' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const doctorA1Password = 'Slice1-DoctorA1-Pass1!';
    const doctorA2Password = 'Slice1-DoctorA2-Pass1!';
    const doctorBPassword = 'Slice1-DoctorB-Pass1!';
    const receptionistAPassword = 'Slice1-ReceptionA-Pass1!';

    // doctorA2 is created FIRST (earlier createdAt) but has a non-matching
    // email — proves default-clinician resolution prefers the configured
    // email over pure "earliest DOCTOR" fallback.
    const doctorA2 = await prisma.authUser.create({
      data: {
        email: 'doctor-a2@hemorrhoid-slice1.example.test',
        passwordHash: await bcrypt.hash(doctorA2Password, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantAId,
      },
    });
    doctorA2Id = doctorA2.id;

    const doctorA1 = await prisma.authUser.create({
      data: {
        email: defaultClinicianEmail,
        passwordHash: await bcrypt.hash(doctorA1Password, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantAId,
      },
    });
    doctorA1Id = doctorA1.id;

    const doctorB = await prisma.authUser.create({
      data: {
        email: 'doctor-b@hemorrhoid-slice1.example.test',
        passwordHash: await bcrypt.hash(doctorBPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantBId,
      },
    });
    doctorBId = doctorB.id;

    await prisma.authUser.create({
      data: {
        email: 'reception-a@hemorrhoid-slice1.example.test',
        passwordHash: await bcrypt.hash(receptionistAPassword, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenantAId,
      },
    });

    const [patientA, patientB] = await Promise.all([
      prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Hemorrhoid Patient A',
          normalizedFullName: 'synthetic hemorrhoid patient a',
          dateOfBirth: new Date('1980-01-01'),
          gender: 'FEMALE',
          phone: '0900000601',
          normalizedPhone: '0900000601',
        },
      }),
      prisma.patient.create({
        data: {
          tenantId: tenantBId,
          fullName: 'Synthetic Hemorrhoid Patient B',
          normalizedFullName: 'synthetic hemorrhoid patient b',
          dateOfBirth: new Date('1981-01-01'),
          gender: 'MALE',
          phone: '0900000602',
          normalizedPhone: '0900000602',
        },
      }),
    ]);
    patientAId = patientA.id;
    patientBId = patientB.id;

    doctorA1Token = await login(defaultClinicianEmail, doctorA1Password);
    doctorA2Token = await login(
      'doctor-a2@hemorrhoid-slice1.example.test',
      doctorA2Password,
    );
    doctorBToken = await login(
      'doctor-b@hemorrhoid-slice1.example.test',
      doctorBPassword,
    );
    receptionistAToken = await login(
      'reception-a@hemorrhoid-slice1.example.test',
      receptionistAPassword,
    );

    const facilityA = await request(app.getHttpServer())
      .post('/facilities')
      .set('Authorization', `Bearer ${doctorA1Token}`)
      .send({ name: 'Synthetic Facility A' })
      .expect(201);
    facilityAId = facilityA.body.id;

    const roomA = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${doctorA1Token}`)
      .send({ facilityId: facilityAId, name: 'Room A-101' })
      .expect(201);
    roomAId = roomA.body.id;

    const facilityB = await request(app.getHttpServer())
      .post('/facilities')
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ name: 'Synthetic Facility B' })
      .expect(201);
    facilityBId = facilityB.body.id;

    const roomB = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ facilityId: facilityBId, name: 'Room B-101' })
      .expect(201);
    roomBId = roomB.body.id;
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
    delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
  });

  describe('Encounter Context', () => {
    it('receptionist creates an Encounter Context, default clinician resolved via configured lookup (not the earliest-created DOCTOR)', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        roomId: roomAId,
        occurredAt: '2026-08-10T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic)',
      });
      expect(response.status).toBe(201);
      expect(response.body.responsibleClinicianId).toBe(doctorA1Id);
      expect(response.body.responsibleClinicianId).not.toBe(doctorA2Id);
      expect(response.body.roomId).toBe(roomAId);
      expect(response.body.clinicalNote).toBe('');
      expect(response.body.assessment).toBe('');
    });

    it('valid explicit clinician assignment is honored', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        responsibleClinicianId: doctorA2Id,
        occurredAt: '2026-08-10T03:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic)',
      });
      expect(response.status).toBe(201);
      expect(response.body.responsibleClinicianId).toBe(doctorA2Id);
    });

    it('a DOCTOR generic create without responsibleClinicianId defaults to the authenticated Doctor actor', async () => {
      const response = await createEncounter(doctorA2Token, {
        patientId: patientAId,
        occurredAt: '2026-08-10T03:30:00.000Z',
        reasonForVisit: 'Khám chung do bác sĩ tạo (synthetic)',
        clinicalNote: 'Ghi chú lâm sàng (synthetic)',
        assessment: 'Đánh giá lâm sàng (synthetic)',
      });
      expect(response.status).toBe(201);
      expect(response.body.responsibleClinicianId).toBe(doctorA2Id);
    });

    it.each([
      ['absent', undefined],
      ['invalid', 'missing-doctor@hemorrhoid-slice1.example.test'],
    ])(
      'a DOCTOR generic create remains independent when PILOT_DEFAULT_CLINICIAN_EMAIL is %s',
      async (_case, configuredEmail) => {
        const originalDefault = process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
        if (configuredEmail === undefined) {
          delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
        } else {
          process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = configuredEmail;
        }

        try {
          const response = await createEncounter(doctorA2Token, {
            patientId: patientAId,
            occurredAt:
              configuredEmail === undefined
                ? '2026-08-10T03:40:00.000Z'
                : '2026-08-10T03:50:00.000Z',
            reasonForVisit: `Khám chung khi default ${_case} (synthetic)`,
            clinicalNote: 'Ghi chú lâm sàng (synthetic)',
            assessment: 'Đánh giá lâm sàng (synthetic)',
          });
          expect(response.status).toBe(201);
          expect(response.body.responsibleClinicianId).toBe(doctorA2Id);
        } finally {
          if (originalDefault === undefined) {
            delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
          } else {
            process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = originalDefault;
          }
        }
      },
    );

    it('rejects a cross-tenant responsibleClinicianId', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        responsibleClinicianId: doctorBId,
        occurredAt: '2026-08-10T04:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic)',
      });
      expect(response.status).toBe(404);
    });

    it('Facility/Room ancestry: Room must belong to a Facility in the same tenant', async () => {
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({ facilityId: facilityBId, name: 'Cross-tenant room attempt' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          facilityId: '00000000-0000-0000-0000-000000000000',
          name: 'Nonexistent facility attempt',
        })
        .expect(400);
    });

    it('rejects cross-tenant Facility/Room reads', async () => {
      await request(app.getHttpServer())
        .get(`/facilities/${facilityBId}`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/rooms/${roomBId}`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(404);
    });

    it('rejects an Encounter referencing a cross-tenant Room', async () => {
      const response = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        roomId: roomBId,
        occurredAt: '2026-08-10T05:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic)',
      });
      expect(response.status).toBe(404);
    });
  });

  describe('Finding 1 — RECEPTIONIST is restricted to an administrative Encounter Context', () => {
    it('rejects a RECEPTIONIST-supplied episodeId', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        episodeId: '00000000-0000-0000-0000-000000000000',
        occurredAt: '2026-08-14T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic finding1 episodeId)',
      });
      expect(response.status).toBe(403);
    });

    it('rejects a RECEPTIONIST-supplied clinicalNote', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        occurredAt: '2026-08-14T02:30:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic finding1 clinicalNote)',
        clinicalNote: 'Ghi chú lâm sàng không được phép (synthetic)',
      });
      expect(response.status).toBe(403);
    });

    it('rejects a RECEPTIONIST-supplied assessment', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        occurredAt: '2026-08-14T03:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic finding1 assessment)',
        assessment: 'Đánh giá lâm sàng không được phép (synthetic)',
      });
      expect(response.status).toBe(403);
    });

    it('rejects a RECEPTIONIST attempt to create a full Longo clinical Encounter (episodeId + clinicalNote + assessment together)', async () => {
      const response = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        episodeId: '00000000-0000-0000-0000-000000000000',
        occurredAt: '2026-08-14T03:30:00.000Z',
        reasonForVisit: 'Khám tiền phẫu Longo (synthetic finding1 combined)',
        clinicalNote: 'Ghi chú (synthetic)',
        assessment: 'Đánh giá (synthetic)',
      });
      expect(response.status).toBe(403);
    });

    it("a DOCTOR's generic create retains full capability (episodeId + clinicalNote + assessment all accepted)", async () => {
      const episode = await request(app.getHttpServer())
        .post('/care-episodes')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          patientId: patientAId,
          episodeType: 'LONGO_TREATMENT',
          startedAt: '2026-08-14T00:00:00.000Z',
        })
        .expect(201);

      const response = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        episodeId: episode.body.id,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-08-14T04:00:00.000Z',
        reasonForVisit: 'Khám tiền phẫu Longo (synthetic finding1 doctor ok)',
        clinicalNote: 'Ghi chú lâm sàng (synthetic)',
        assessment: 'Đánh giá lâm sàng (synthetic)',
      });
      expect(response.status).toBe(201);
      expect(response.body.episodeId).toBe(episode.body.id);
      expect(response.body.clinicalNote).toBe('Ghi chú lâm sàng (synthetic)');
      expect(response.body.assessment).toBe('Đánh giá lâm sàng (synthetic)');
    });
  });

  describe('Clinician handover', () => {
    let handoverEncounterId: string;

    beforeAll(async () => {
      const created = await createEncounter(receptionistAToken, {
        patientId: patientAId,
        responsibleClinicianId: doctorA1Id,
        roomId: roomAId,
        occurredAt: '2026-08-11T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ - bàn giao (synthetic)',
      });
      handoverEncounterId = created.body.id;
    });

    it('rejects a single no-op handover without mutating Encounter or appending history/audit', async () => {
      const historyBefore = await prisma.clinicianAssignmentHistory.count({
        where: { tenantId: tenantAId, encounterId: handoverEncounterId },
      });
      const auditBefore = await prisma.auditEvent.count({
        where: {
          tenantId: tenantAId,
          entityId: handoverEncounterId,
          action: 'ENCOUNTER_CLINICIAN_HANDOVER',
        },
      });

      await request(app.getHttpServer())
        .post(`/encounters/${handoverEncounterId}/handover`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({ newClinicianId: doctorA1Id, reason: 'No-op attempt' })
        .expect(409);

      const encounter = await prisma.encounter.findUniqueOrThrow({
        where: { id: handoverEncounterId },
      });
      expect(encounter.responsibleClinicianId).toBe(doctorA1Id);
      await expect(
        prisma.clinicianAssignmentHistory.count({
          where: { tenantId: tenantAId, encounterId: handoverEncounterId },
        }),
      ).resolves.toBe(historyBefore);
      await expect(
        prisma.auditEvent.count({
          where: {
            tenantId: tenantAId,
            entityId: handoverEncounterId,
            action: 'ENCOUNTER_CLINICIAN_HANDOVER',
          },
        }),
      ).resolves.toBe(auditBefore);
    });

    it('rejects two concurrent no-op handovers without appending history/audit', async () => {
      const historyBefore = await prisma.clinicianAssignmentHistory.count({
        where: { tenantId: tenantAId, encounterId: handoverEncounterId },
      });
      const auditBefore = await prisma.auditEvent.count({
        where: {
          tenantId: tenantAId,
          entityId: handoverEncounterId,
          action: 'ENCOUNTER_CLINICIAN_HANDOVER',
        },
      });

      const responses = await Promise.all([
        request(app.getHttpServer())
          .post(`/encounters/${handoverEncounterId}/handover`)
          .set('Authorization', `Bearer ${doctorA1Token}`)
          .send({ newClinicianId: doctorA1Id, reason: 'Concurrent no-op 1' }),
        request(app.getHttpServer())
          .post(`/encounters/${handoverEncounterId}/handover`)
          .set('Authorization', `Bearer ${doctorA1Token}`)
          .send({ newClinicianId: doctorA1Id, reason: 'Concurrent no-op 2' }),
      ]);

      expect(responses.map((response) => response.status)).toEqual([409, 409]);
      const encounter = await prisma.encounter.findUniqueOrThrow({
        where: { id: handoverEncounterId },
      });
      expect(encounter.responsibleClinicianId).toBe(doctorA1Id);
      await expect(
        prisma.clinicianAssignmentHistory.count({
          where: { tenantId: tenantAId, encounterId: handoverEncounterId },
        }),
      ).resolves.toBe(historyBefore);
      await expect(
        prisma.auditEvent.count({
          where: {
            tenantId: tenantAId,
            entityId: handoverEncounterId,
            action: 'ENCOUNTER_CLINICIAN_HANDOVER',
          },
        }),
      ).resolves.toBe(auditBefore);
    });

    it('valid authorized handover reassigns responsibleClinicianId', async () => {
      const response = await request(app.getHttpServer())
        .post(`/encounters/${handoverEncounterId}/handover`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({ newClinicianId: doctorA2Id, reason: 'Bàn giao ca trực' })
        .expect(201);
      expect(response.body.responsibleClinicianId).toBe(doctorA2Id);
    });

    it('previous-assignment provenance is preserved in full', async () => {
      const response = await request(app.getHttpServer())
        .get(`/encounters/${handoverEncounterId}/clinician-history`)
        .set('Authorization', `Bearer ${doctorA2Token}`)
        .expect(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        clinicianId: doctorA1Id,
        previousClinicianId: null,
      });
      expect(response.body[1]).toMatchObject({
        clinicianId: doctorA2Id,
        previousClinicianId: doctorA1Id,
      });
    });

    it('an AuditEvent is emitted for the handover, and the historical creation event keeps its original actor', async () => {
      const events = await prisma.auditEvent.findMany({
        where: { tenantId: tenantAId, entityId: handoverEncounterId },
        orderBy: { seq: 'asc' },
      });
      const created = events.find((e) => e.action === 'ENCOUNTER_CREATED');
      const handover = events.find(
        (e) => e.action === 'ENCOUNTER_CLINICIAN_HANDOVER',
      );
      expect(created).toBeDefined();
      expect(handover).toBeDefined();
      // Historical creation event is never rewritten by the later handover.
      expect(created?.actorId).not.toBe(handover?.actorId);
      expect(handover?.metadata).toMatchObject({
        previousClinicianId: doctorA1Id,
        newClinicianId: doctorA2Id,
      });
    });

    it('rejects handover by an unauthorized actor (RECEPTIONIST)', async () => {
      await request(app.getHttpServer())
        .post(`/encounters/${handoverEncounterId}/handover`)
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({ newClinicianId: doctorA1Id })
        .expect(403);
    });

    it('rejects handover to a cross-tenant clinician', async () => {
      await request(app.getHttpServer())
        .post(`/encounters/${handoverEncounterId}/handover`)
        .set('Authorization', `Bearer ${doctorA2Token}`)
        .send({ newClinicianId: doctorBId })
        .expect(404);
    });

    it('Finding 4 — concurrent handovers racing from the same previous clinician: only one transition commits, the other gets 409, history does not fork', async () => {
      // At this point responsibleClinicianId is doctorA2Id (from the first
      // handover test above). Fire two concurrent handover requests that
      // both start from that same expected-previous value.
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post(`/encounters/${handoverEncounterId}/handover`)
          .set('Authorization', `Bearer ${doctorA2Token}`)
          .send({ newClinicianId: doctorA1Id, reason: 'Race attempt 1' }),
        request(app.getHttpServer())
          .post(`/encounters/${handoverEncounterId}/handover`)
          .set('Authorization', `Bearer ${doctorA2Token}`)
          .send({ newClinicianId: doctorA1Id, reason: 'Race attempt 2' }),
      ]);

      const statuses = [first.status, second.status].sort();
      // Exactly one succeeds (the optimistic-concurrency `updateMany` guard
      // only matches a row whose responsibleClinicianId still equals the
      // previous value at the moment of the write); the other observes a
      // stale previous value and is rejected with 409 — never both
      // succeeding, never both failing.
      expect(statuses).toEqual([201, 409]);

      const finalEncounter = await request(app.getHttpServer())
        .get(`/encounters/${handoverEncounterId}`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(200);
      expect(finalEncounter.body.responsibleClinicianId).toBe(doctorA1Id);

      // History does not fork: exactly one new ClinicianAssignmentHistory
      // row for this race, appended after the earlier two (initial
      // assignment + first handover), for a total of 3 — not 4.
      const history = await request(app.getHttpServer())
        .get(`/encounters/${handoverEncounterId}/clinician-history`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(200);
      expect(history.body).toHaveLength(3);
      expect(history.body[2]).toMatchObject({
        clinicianId: doctorA1Id,
        previousClinicianId: doctorA2Id,
      });

      // The successful transition's AuditEvent exists — committed atomically
      // in the same transaction as the Encounter update and history row, so
      // a successful (201) handover is never observable without it.
      const events = await prisma.auditEvent.findMany({
        where: {
          tenantId: tenantAId,
          entityId: handoverEncounterId,
          action: 'ENCOUNTER_CLINICIAN_HANDOVER',
        },
      });
      expect(events).toHaveLength(2); // the first handover test's + this race's single winner
    });
  });

  describe('HEMORRHOID_EXAMINATION v1', () => {
    let emptyEncounterId: string;
    let emptySubmissionId: string;

    it('a fully empty examination can go DRAFT -> COMPLETED (no field is required)', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-08-12T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic empty exam)',
      });
      emptyEncounterId = encounter.body.id;

      const created = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: emptyEncounterId,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: {},
        })
        .expect(201);
      emptySubmissionId = created.body.id;
      expect(created.body.status).toBe(ClinicalFormStatus.DRAFT);

      const completed = await request(app.getHttpServer())
        .post(`/clinical-forms/${emptySubmissionId}/complete`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(201);
      expect(completed.body.status).toBe(ClinicalFormStatus.COMPLETED);
      expect(completed.body.responses).toEqual({});
    });

    it('completed form is immutable: draft edit and re-complete are rejected', async () => {
      await request(app.getHttpServer())
        .patch(`/clinical-forms/${emptySubmissionId}/draft`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({ responses: {} })
        .expect(409);

      await request(app.getHttpServer())
        .post(`/clinical-forms/${emptySubmissionId}/complete`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(409);
    });

    it('amendment lineage: amending the empty examination creates revision 2', async () => {
      await request(app.getHttpServer())
        .post(`/clinical-forms/${emptySubmissionId}/amend`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          responses: { historyConstipation: true },
          amendmentReason: 'Bổ sung tiền sử táo bón (synthetic)',
        })
        .expect(201);

      const history = await request(app.getHttpServer())
        .get(`/clinical-forms/${emptySubmissionId}/history`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(200);
      expect(history.body.revisions).toHaveLength(2);
      expect(history.body.revisions[0].revisionNumber).toBe(1);
      expect(history.body.revisions[1].revisionNumber).toBe(2);
      expect(history.body.revisions[1].previousSubmissionId).toBe(
        emptySubmissionId,
      );
      expect(history.body.current.responses).toMatchObject({
        historyConstipation: true,
      });
    });

    it('accepts Internal/External/Mixed count/location/size (independent per group), exactly one goligherGrade, and the symptom/observed split for prolapse and bleeding', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-08-13T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic morphology)',
      });

      const responses = {
        hemorrhoidGoligherGrade: 'III',
        internalHemorrhoidCount: 2,
        internalHemorrhoidLocation: [3, 7],
        internalHemorrhoidSize: '1.5cm (synthetic)',
        externalHemorrhoidCount: 1,
        externalHemorrhoidLocation: [11],
        externalHemorrhoidSize: '0.8cm (synthetic)',
        mixedHemorrhoidCount: 1,
        mixedHemorrhoidLocation: [5],
        mixedHemorrhoidSize: '2.1cm (synthetic)',
        prolapseSymptom: true,
        prolapseObserved: false,
        bleedingSymptom: false,
        bleedingObserved: true,
      };

      const created = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses,
        })
        .expect(201);

      const completed = await request(app.getHttpServer())
        .post(`/clinical-forms/${created.body.id}/complete`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(201);

      expect(completed.body.responses).toMatchObject(responses);
      // Each hemorrhoid group's size is independently stored — distinct
      // values for Internal/External/Mixed prove there is no shared
      // "mainHemorrhoidSize" field silently backing all three.
      expect(completed.body.responses.internalHemorrhoidSize).toBe(
        '1.5cm (synthetic)',
      );
      expect(completed.body.responses.externalHemorrhoidSize).toBe(
        '0.8cm (synthetic)',
      );
      expect(completed.body.responses.mixedHemorrhoidSize).toBe(
        '2.1cm (synthetic)',
      );
      // No legacy undifferentiated size field is present in the persisted
      // response.
      expect(completed.body.responses.mainHemorrhoidSize).toBeUndefined();
      // Symptom vs observed are independently stored, not derived from
      // each other.
      expect(completed.body.responses.prolapseSymptom).toBe(true);
      expect(completed.body.responses.prolapseObserved).toBe(false);
      expect(completed.body.responses.bleedingSymptom).toBe(false);
      expect(completed.body.responses.bleedingObserved).toBe(true);
    });

    it('rejects the legacy undifferentiated mainHemorrhoidSize field (no longer a valid capture field)', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-08-13T02:30:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic reject legacy field)',
      });

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: { mainHemorrhoidSize: '1.5cm' },
        })
        .expect(400);
    });

    it('rejects an unknown field (e.g. a fabricated per-lesion goligherGrade)', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: patientAId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-08-13T03:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic reject unknown field)',
      });

      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: { internalGoligherGrade: 'II' },
        })
        .expect(400);
    });

    it('a COMPLETED HEMORRHOID_EXAMINATION appears in the patient Timeline as a CLINICAL_FORM_SUBMITTED event', async () => {
      const timeline = await request(app.getHttpServer())
        .get(`/patients/${patientAId}/timeline`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(200);

      // These HEMORRHOID_EXAMINATION Encounters were created with no
      // episodeId (DEC-010 §D — no auto-created/inferred CareEpisode), so
      // their events land in `ungroupedEncounters`, not inside `episodes`.
      type TimelineEvent = {
        type: string;
        data: { templateKey?: string };
      };
      const events = timeline.body.ungroupedEncounters as TimelineEvent[];
      const hasHemorrhoidExam = events.some(
        (event) =>
          event.type === 'CLINICAL_FORM_SUBMITTED' &&
          event.data.templateKey === 'HEMORRHOID_EXAMINATION',
      );
      expect(hasHemorrhoidExam).toBe(true);
    });
  });

  describe('Vital-sign copy-forward (Finding 2 — target-aware)', () => {
    let vitalsPatientId: string;

    beforeAll(async () => {
      const patient = await prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Vitals Copy-Forward Patient',
          normalizedFullName: 'synthetic vitals copy-forward patient',
          dateOfBirth: new Date('1985-05-05'),
          gender: 'FEMALE',
          phone: '0900000603',
          normalizedPhone: '0900000603',
        },
      });
      vitalsPatientId = patient.id;
    });

    async function createCompletedExam(
      occurredAt: string,
      vitals: Record<string, number>,
    ) {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: vitalsPatientId,
        responsibleClinicianId: doctorA1Id,
        occurredAt,
        reasonForVisit: 'Khám trĩ (synthetic vitals)',
      });
      const created = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: vitals,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/clinical-forms/${created.body.id}/complete`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(201);
      return created.body.id as string;
    }

    /** A throwaway target Encounter used only to probe the copy-forward
     * endpoint at a given clinical time — this is exactly the pattern the
     * real frontend uses (create the Encounter Context, then open the
     * HEMORRHOID_EXAMINATION form for that Encounter, which queries
     * copy-forward by that Encounter's id). */
    async function probeEncounter(
      occurredAt: string,
      patientId: string = vitalsPatientId,
    ): Promise<string> {
      const encounter = await createEncounter(doctorA1Token, {
        patientId,
        responsibleClinicianId: doctorA1Id,
        occurredAt,
        reasonForVisit: 'Khám trĩ (synthetic copy-forward probe)',
      });
      return encounter.body.id as string;
    }

    function copyForwardFor(targetEncounterId: string, token: string) {
      return request(app.getHttpServer())
        .get(
          `/clinical-forms/vitals-copy-forward?targetEncounterId=${targetEncounterId}`,
        )
        .set('Authorization', `Bearer ${token}`);
    }

    it('no eligible prior record -> null copy-forward result', async () => {
      const target = await probeEncounter('2026-08-20T00:00:00.000Z');
      const response = await copyForwardFor(target, doctorA1Token).expect(
        200,
      );
      expect(response.body?.sourceSubmissionId).toBeUndefined();
    });

    it('DRAFT submissions are excluded from copy-forward', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: vitalsPatientId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-09-01T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic draft only)',
      });
      await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: { weight: 999 },
        })
        .expect(201);

      const target = await probeEncounter('2026-09-02T00:00:00.000Z');
      const response = await copyForwardFor(target, doctorA1Token).expect(
        200,
      );
      expect(response.body?.sourceSubmissionId).toBeUndefined();
    });

    let earlierSubmissionId: string;
    let laterSubmissionId: string;

    it('selects the latest record by Encounter.occurredAt, not by createdAt insertion order', async () => {
      // Insert the LATER-occurredAt record FIRST (earlier createdAt), then
      // the EARLIER-occurredAt record second (later createdAt) — proves
      // selection is driven by occurredAt, not row insertion order.
      laterSubmissionId = await createCompletedExam('2026-09-10T02:00:00.000Z', {
        weight: 60,
        height: 160,
      });
      earlierSubmissionId = await createCompletedExam(
        '2026-09-05T02:00:00.000Z',
        { weight: 55, height: 155 },
      );

      const target = await probeEncounter('2026-09-20T00:00:00.000Z');
      const response = await copyForwardFor(target, doctorA1Token).expect(
        200,
      );
      expect(response.body.sourceSubmissionId).toBe(laterSubmissionId);
      expect(response.body.vitals).toMatchObject({ weight: 60, height: 160 });
      expect(response.body.sourceSubmissionId).not.toBe(earlierSubmissionId);
    });

    it('a backdated target Encounter does NOT pick up a future examination — occurredAt ordering invariant', async () => {
      // Target backdated to between the earlier (09-05) and later (09-10)
      // exams. From this target's clinical viewpoint, the 09-10 exam is in
      // the future and MUST NOT be copied forward — only the 09-05 exam
      // (still strictly before the target) is eligible.
      const backdatedTarget = await probeEncounter('2026-09-07T00:00:00.000Z');
      const response = await copyForwardFor(
        backdatedTarget,
        doctorA1Token,
      ).expect(200);
      expect(response.body.sourceSubmissionId).toBe(earlierSubmissionId);
      expect(response.body.vitals).toMatchObject({ weight: 55, height: 155 });
      expect(response.body.sourceSubmissionId).not.toBe(laterSubmissionId);
    });

    it('user edit of a pre-filled value persists as the new examination\'s own frozen snapshot; unchanged copied values are also persisted as their own snapshot', async () => {
      const encounter = await createEncounter(doctorA1Token, {
        patientId: vitalsPatientId,
        responsibleClinicianId: doctorA1Id,
        occurredAt: '2026-09-15T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (synthetic new exam from copy-forward)',
      });

      const copyForward = await copyForwardFor(
        encounter.body.id,
        doctorA1Token,
      ).expect(200);
      expect(copyForward.body.vitals.weight).toBe(60);

      const created = await request(app.getHttpServer())
        .post('/clinical-forms')
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          encounterId: encounter.body.id,
          templateKey: 'HEMORRHOID_EXAMINATION',
          responses: {
            ...copyForward.body.vitals,
            weight: 61, // user edits the pre-filled weight
            // height (160) is left unchanged from the copy-forward value.
          },
        })
        .expect(201);
      const completed = await request(app.getHttpServer())
        .post(`/clinical-forms/${created.body.id}/complete`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(201);

      expect(completed.body.responses.weight).toBe(61);
      expect(completed.body.responses.height).toBe(160);

      // A later amendment to the ORIGINAL source record (laterSubmissionId,
      // weight 60) must never retroactively change the already-saved
      // snapshot above.
      await request(app.getHttpServer())
        .post(`/clinical-forms/${laterSubmissionId}/amend`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .send({
          responses: { weight: 999, height: 160 },
          amendmentReason: 'Sửa lại cân nặng nguồn (synthetic)',
        })
        .expect(201);

      const stillFrozen = await request(app.getHttpServer())
        .get(`/clinical-forms/${created.body.id}`)
        .set('Authorization', `Bearer ${doctorA1Token}`)
        .expect(200);
      expect(stillFrozen.body.responses.weight).toBe(61);
      expect(stillFrozen.body.responses.height).toBe(160);
    });

    it('is scoped strictly to the same tenant + same patient (no cross-tenant/cross-patient contamination)', async () => {
      // A different patient in the same tenant must not see vitalsPatientId's data.
      const otherPatient = await prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Other Patient (no exams)',
          normalizedFullName: 'synthetic other patient (no exams)',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'MALE',
          phone: '0900000604',
          normalizedPhone: '0900000604',
        },
      });
      const otherPatientTarget = await probeEncounter(
        '2026-12-01T00:00:00.000Z',
        otherPatient.id,
      );
      const response = await copyForwardFor(
        otherPatientTarget,
        doctorA1Token,
      ).expect(200);
      expect(response.body?.sourceSubmissionId).toBeUndefined();

      // Tenant B's doctor cannot even resolve tenant A's target Encounter —
      // the endpoint 404s rather than leaking data through a cross-tenant
      // probe (target Encounter lookup is itself tenant-scoped).
      const anyTenantATarget = await probeEncounter('2026-12-01T00:00:00.000Z');
      await copyForwardFor(anyTenantATarget, doctorBToken).expect(404);
    });

    it('deterministic tie-break when two eligible prior records share the exact same occurredAt', async () => {
      const tiedOccurredAt = '2026-10-01T02:00:00.000Z';
      const submissionOneId = await createCompletedExam(tiedOccurredAt, {
        weight: 70,
      });
      const submissionTwoId = await createCompletedExam(tiedOccurredAt, {
        weight: 71,
      });

      // Documented tie-break (see ClinicalFormsService.getVitalsCopyForward):
      // occurredAt desc, then revisionNumber desc, then id desc (string
      // compare) — both are revision 1, so the higher id wins. Compute the
      // expected winner the same way and assert the endpoint is stable
      // across repeated calls (determinism), matching that computation.
      const expectedWinnerId =
        submissionOneId > submissionTwoId ? submissionOneId : submissionTwoId;

      const target = await probeEncounter('2026-10-02T00:00:00.000Z');
      const first = await copyForwardFor(target, doctorA1Token).expect(200);
      const second = await copyForwardFor(target, doctorA1Token).expect(200);

      expect(first.body.sourceSubmissionId).toBe(expectedWinnerId);
      expect(second.body.sourceSubmissionId).toBe(expectedWinnerId);
      expect(first.body.sourceSubmissionId).toBe(
        second.body.sourceSubmissionId,
      );
    });
  });
});
