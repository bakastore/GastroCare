import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthRole, CarePlanStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-03 — Pilot Readiness & Operational Hardening acceptance evidence.
 *
 * This suite does NOT repeat what CORE-01's suite already proves (RBAC
 * ALLOW/DENY per resource, tenant isolation on reads, audit completeness,
 * clinical immutability/lineage, derived OVERDUE, read-only Timeline — see
 * core01-clinical-walking-skeleton.e2e-spec.ts). It covers the genuine gaps
 * CORE-03 calls out: token hardening (malformed/expired/tampered), explicit
 * cross-tenant MUTATION attempts (not just reads), RECEPTIONIST against
 * CareTask/CarePlan write routes, and error-response safety (no leaked
 * internals) across 400/401/403/404/409.
 *
 * Synthetic data only.
 */
describe('CORE-03 — Pilot Readiness & Operational Hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };

  const doctorAPassword = 'Core3DoctorA-Pass1!';
  const receptionistAPassword = 'Core3ReceptionA-Pass1!';
  const doctorBPassword = 'Core3DoctorB-Pass1!';

  let doctorAToken: string;
  let receptionistAToken: string;
  let doctorBToken: string;

  let jwtSecret: string;

  beforeAll(async () => {
    // Finding 3 correction — default clinician resolution is fail-closed
    // and requires an explicit config pointing at a real seeded DOCTOR;
    // set it before app bootstrap so ConfigModule picks it up.
    process.env.PILOT_DEFAULT_CLINICIAN_EMAIL =
      'doctor-a@core03-test.gastrocare.local';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtSecret = process.env.JWT_SECRET as string;

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

    tenantA = await prisma.tenant.create({
      data: { name: 'CORE-03 Test Tenant A' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'CORE-03 Test Tenant B' },
    });

    await prisma.authUser.create({
      data: {
        email: 'doctor-a@core03-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorAPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'receptionist-a@core03-test.gastrocare.local',
        passwordHash: await bcrypt.hash(receptionistAPassword, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'doctor-b@core03-test.gastrocare.local',
        passwordHash: await bcrypt.hash(doctorBPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenantB.id,
      },
    });

    doctorAToken = await loginAs(
      'doctor-a@core03-test.gastrocare.local',
      doctorAPassword,
    );
    receptionistAToken = await loginAs(
      'receptionist-a@core03-test.gastrocare.local',
      receptionistAPassword,
    );
    doctorBToken = await loginAs(
      'doctor-b@core03-test.gastrocare.local',
      doctorBPassword,
    );
  });

  afterAll(async () => {
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
    await app.close();
    delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  // ---------------------------------------------------------------------
  // H. Auth/session hardening
  // ---------------------------------------------------------------------
  describe('H. Auth/session token hardening', () => {
    it('missing Authorization header is rejected (401)', async () => {
      await request(app.getHttpServer()).get('/patients').expect(401);
    });

    it('malformed token (not a JWT at all) is rejected (401), no internals leaked', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', 'Bearer not-a-jwt-at-all')
        .expect(401);
      expect(res.body).toEqual({ message: 'Unauthorized', statusCode: 401 });
    });

    it('tampered signature is rejected (401)', async () => {
      const tampered = doctorAToken.slice(0, -4) + 'abcd';
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });

    it('expired token is rejected (401) even with a correctly signed payload', async () => {
      const expired = jwt.sign(
        {
          sub: 'x',
          tenantId: tenantA.id,
          email: 'doctor-a@core03-test.gastrocare.local',
          role: AuthRole.DOCTOR,
        },
        jwtSecret,
        { expiresIn: -10 },
      );
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('a token signed with the wrong secret is rejected (401)', async () => {
      const forged = jwt.sign(
        {
          sub: 'x',
          tenantId: tenantA.id,
          email: 'attacker@example.test',
          role: AuthRole.DOCTOR,
        },
        'wrong-secret-not-the-real-one',
      );
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('invalid login credentials never distinguish "no such user" from "wrong password"', async () => {
      const noSuchUser = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nobody@core03-test.gastrocare.local',
          password: 'whatever123',
        })
        .expect(401);
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'doctor-a@core03-test.gastrocare.local',
          password: 'wrong-password',
        })
        .expect(401);
      expect(noSuchUser.body.message).toBe(wrongPassword.body.message);
    });

    it('logout is client-side only (stateless JWT) — the same token keeps working server-side, so the frontend MUST discard it locally', async () => {
      // Documents the actual security model: there is no server-side session
      // to invalidate. The token remains valid until natural expiry, which
      // is why the frontend clears it from storage on logout and 401
      // (see frontend/src/auth/AuthContext.tsx). Confirms nothing broke
      // that assumption.
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------
  // I. RECEPTIONIST vs CareTask/CarePlan write routes (gap not covered by
  //    CORE-01's suite, which only proves Encounter/CarePlan-read/Timeline).
  // ---------------------------------------------------------------------
  describe('I. RECEPTIONIST denied on every clinical write/read route', () => {
    it('receptionist cannot create a CarePlan (403)', async () => {
      await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .send({
          encounterId: '00000000-0000-0000-0000-000000000000',
          instructions: 'x',
        })
        .expect(403);
    });

    it('receptionist cannot list care-tasks (403)', async () => {
      await request(app.getHttpServer())
        .get('/care-tasks')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('receptionist cannot complete a care-task (403)', async () => {
      await request(app.getHttpServer())
        .post('/care-tasks/00000000-0000-0000-0000-000000000000/complete')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });

    it('receptionist cannot cancel a care-task (403)', async () => {
      await request(app.getHttpServer())
        .post('/care-tasks/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------
  // J. Cross-tenant MUTATION attempts (not just reads) — proves tenantId
  //    from the JWT, never a client-supplied id, is the write boundary too.
  // ---------------------------------------------------------------------
  describe('J. Cross-tenant mutation attempts are rejected, not silently scoped', () => {
    let patientAId: string;
    let encounterAId: string;
    let carePlanAId: string;
    let careTaskAId: string;

    beforeAll(async () => {
      const patientRes = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Le Thi Synthetic',
          dateOfBirth: '1990-01-01',
          gender: 'FEMALE',
          phone: '0900000001',
        })
        .expect(201);
      patientAId = patientRes.body.patient.id;

      const encounterRes = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientAId,
          occurredAt: '2026-08-01T09:00:00.000Z',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);
      encounterAId = encounterRes.body.id;

      const carePlanRes = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          encounterId: encounterAId,
          instructions: 'x',
          followUpDate: '2026-09-05',
        })
        .expect(201);
      carePlanAId = carePlanRes.body.id;

      const signRes = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanAId}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);
      careTaskAId = signRes.body.careTask.id;
    });

    it('doctorId from Tenant B cannot create an Encounter for a Tenant A Patient (tenantId spoofing via patientId is rejected, 404)', async () => {
      await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          patientId: patientAId,
          occurredAt: '2026-08-01T09:00:00.000Z',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(404);
    });

    it('Tenant B cannot create a CarePlan against a Tenant A Encounter (404)', async () => {
      await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({ encounterId: encounterAId, instructions: 'x' })
        .expect(404);
    });

    it('Tenant B cannot sign a Tenant A CarePlan (404)', async () => {
      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanAId}/sign`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('Tenant B cannot amend a Tenant A CarePlan (404)', async () => {
      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanAId}/amend`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .send({
          instructions: 'attacker edit',
          reason: 'attacker reason',
          expectedCurrentVersionId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('Tenant B cannot complete a Tenant A CareTask (404)', async () => {
      await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskAId}/complete`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('Tenant B cannot cancel a Tenant A CareTask (404)', async () => {
      await request(app.getHttpServer())
        .post(`/care-tasks/${careTaskAId}/cancel`)
        .set('Authorization', `Bearer ${doctorBToken}`)
        .expect(404);
    });

    it('the Tenant A CarePlan and CareTask were not modified by any of the rejected Tenant B attempts', async () => {
      const carePlan = await prisma.carePlan.findUniqueOrThrow({
        where: { id: carePlanAId },
      });
      expect(carePlan.status).toBe(CarePlanStatus.SIGNED);
      expect(carePlan.instructions).toBe('x');

      const careTask = await prisma.careTask.findUniqueOrThrow({
        where: { id: careTaskAId },
      });
      expect(careTask.status).toBe('OPEN');
    });
  });

  // ---------------------------------------------------------------------
  // K. Error-response safety — no internals leaked across 400/401/403/404/409
  // ---------------------------------------------------------------------
  describe('K. Error responses never leak internals', () => {
    const forbiddenSubstrings = [
      'prisma',
      'Prisma',
      'node_modules',
      'at ei.',
      '.ts:',
      '.js:',
      'stack',
      'ECONNREFUSED',
      '/home/',
      'JWT_SECRET',
      'DATABASE_URL',
    ];

    function assertNoLeakage(body: unknown) {
      const serialized = JSON.stringify(body);
      for (const needle of forbiddenSubstrings) {
        expect(serialized).not.toContain(needle);
      }
    }

    it('malformed JSON body -> 400, clean message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{not valid json')
        .expect(400);
      assertNoLeakage(res.body);
    });

    it('validation failure -> 400, field-level messages only', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({})
        .expect(400);
      assertNoLeakage(res.body);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('unknown route -> 404, no framework internals', async () => {
      const res = await request(app.getHttpServer())
        .get('/this-route-does-not-exist')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(404);
      assertNoLeakage(res.body);
    });

    it('not-found entity -> 404, clean domain message', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(404);
      assertNoLeakage(res.body);
      expect(res.body.message).toBe('Patient not found');
    });

    it('conflict (double-sign) -> 409, clean domain message', async () => {
      const patientRes = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          fullName: 'Pham Van Synthetic',
          dateOfBirth: '1991-02-02',
          gender: 'MALE',
          phone: '0900000002',
        })
        .expect(201);

      const encounterRes = await request(app.getHttpServer())
        .post('/encounters')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({
          patientId: patientRes.body.patient.id,
          occurredAt: '2026-08-02T09:00:00.000Z',
          reasonForVisit: 'x',
          clinicalNote: 'x',
          assessment: 'x',
        })
        .expect(201);

      const carePlanRes = await request(app.getHttpServer())
        .post('/care-plans')
        .set('Authorization', `Bearer ${doctorAToken}`)
        .send({ encounterId: encounterRes.body.id, instructions: 'x' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/care-plans/${carePlanRes.body.id}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/care-plans/${carePlanRes.body.id}/sign`)
        .set('Authorization', `Bearer ${doctorAToken}`)
        .expect(409);
      assertNoLeakage(res.body);
    });

    it('cross-role denial (403) -> clean message, no internals', async () => {
      const res = await request(app.getHttpServer())
        .get('/care-tasks')
        .set('Authorization', `Bearer ${receptionistAToken}`)
        .expect(403);
      assertNoLeakage(res.body);
    });
  });
});
