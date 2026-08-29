import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, AuthUserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DEC-018 — Admin Boundary / User Management v1 (e2e). OWNER LOCKED,
 * docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md.
 *
 * Real PostgreSQL. Synthetic data only. Covers T2 authentication / DB-backed
 * current authority / session revocation, T3 Clinic Admin API + password
 * lifecycle, T4 lifecycle / last-admin invariant (sequential + concurrent) /
 * Facility-Room boundary / audit, and the T6 Gate B / authorization-matrix /
 * tenant-isolation cases.
 */
describe('DEC-018 Admin Boundary / User Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const PW = 'Dec018-Synthetic-Pass1!';

  let tenantAId: string;
  let tenantBId: string;

  const ids: Record<string, string> = {};

  async function resetTables() {
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
  }

  async function mkUser(
    key: string,
    tenantId: string,
    role: AuthRole,
    isClinicAdmin: boolean,
  ) {
    const u = await prisma.authUser.create({
      data: {
        email: `${key}@dec018.example.test`,
        passwordHash: await bcrypt.hash(PW, 10),
        role,
        tenantId,
        isClinicAdmin,
        status: AuthUserStatus.ACTIVE,
        mustChangePassword: false,
        sessionVersion: 0,
      },
    });
    ids[key] = u.id;
    return u;
  }

  async function login(key: string, password = PW): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `${key}@dec018.example.test`, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  const me = (token: string) =>
    request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

  const listUsers = (token: string) =>
    request(app.getHttpServer())
      .get('/clinic-admin/users')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await resetTables();

    const tenantA = await prisma.tenant.create({
      data: { name: 'DEC-018 Synthetic Tenant A' },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: 'DEC-018 Synthetic Tenant B' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    await mkUser('adminDoc', tenantAId, AuthRole.DOCTOR, true);
    await mkUser('adminNurse', tenantAId, AuthRole.NURSE, true);
    await mkUser('adminRecep', tenantAId, AuthRole.RECEPTIONIST, true);
    await mkUser('plainDoc', tenantAId, AuthRole.DOCTOR, false);
    await mkUser('plainNurse', tenantAId, AuthRole.NURSE, false);
    await mkUser('plainRecep', tenantAId, AuthRole.RECEPTIONIST, false);

    await mkUser('adminB', tenantBId, AuthRole.DOCTOR, true);
    await mkUser('plainDocB', tenantBId, AuthRole.DOCTOR, false);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe('T2 — tenant JWT v1 shape + login status gate', () => {
    it('the access token carries only sub / realm / sessionVersion', async () => {
      const token = await login('adminDoc');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      expect(Object.keys(payload).sort()).toEqual(
        ['exp', 'iat', 'realm', 'sessionVersion', 'sub'].sort(),
      );
      expect(payload.realm).toBe('TENANT');
      expect(payload).not.toHaveProperty('role');
      expect(payload).not.toHaveProperty('tenantId');
      expect(payload).not.toHaveProperty('email');
      expect(payload).not.toHaveProperty('isClinicAdmin');
    });

    it('ACTIVE user can log in; DISABLED user cannot', async () => {
      await mkUser('willDisable', tenantAId, AuthRole.DOCTOR, false);
      await login('willDisable');
      await prisma.authUser.update({
        where: { id: ids.willDisable },
        data: { status: AuthUserStatus.DISABLED },
      });
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'willDisable@dec018.example.test', password: PW })
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T6 Gate B — SAME-token authority freshness (resolved from DB)', () => {
    it('1. role change (DOCTOR -> NURSE) is visible on a reused token', async () => {
      const u = await mkUser('gbRole', tenantAId, AuthRole.DOCTOR, false);
      const token = await login('gbRole');
      expect((await me(token)).body.role).toBe('DOCTOR');

      const adminToken = await login('adminDoc');
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${u.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'NURSE' })
        .expect(200);

      expect((await me(token)).body.role).toBe('NURSE');
    });

    it('2. Clinic Admin revoke -> /clinic-admin/* denies the reused token immediately', async () => {
      const u = await mkUser('gbRevoke', tenantAId, AuthRole.NURSE, true);
      const token = await login('gbRevoke');
      await listUsers(token).expect(200);

      const adminToken = await login('adminDoc');
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${u.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isClinicAdmin: false })
        .expect(200);

      await listUsers(token).expect(403);
    });

    it('3. disable -> the reused token is rejected on the next request', async () => {
      const u = await mkUser('gbDisable', tenantAId, AuthRole.DOCTOR, false);
      const token = await login('gbDisable');
      await me(token).expect(200);

      const adminToken = await login('adminDoc');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${u.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await me(token).expect(401);
    });

    it('4. password reset -> the old token is rejected', async () => {
      const u = await mkUser('gbReset', tenantAId, AuthRole.RECEPTIONIST, false);
      const token = await login('gbReset');
      await me(token).expect(200);

      const adminToken = await login('adminDoc');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${u.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await me(token).expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T2/T3 — create user + forced password change', () => {
    it('creates a user, returns the temporary password once, forces a change, invalidates the temp-password token', async () => {
      const adminToken = await login('adminDoc');
      const created = await request(app.getHttpServer())
        .post('/clinic-admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'fresh.doc@dec018.example.test', role: 'DOCTOR' })
        .expect(201);

      const tempPassword: string = created.body.temporaryPassword;
      expect(typeof tempPassword).toBe('string');
      expect(tempPassword.length).toBeGreaterThanOrEqual(12);
      expect(created.body.user.mustChangePassword).toBe(true);
      expect(created.body.user).not.toHaveProperty('passwordHash');

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'fresh.doc@dec018.example.test', password: tempPassword })
        .expect(200);
      const tempToken = loginRes.body.accessToken as string;

      // /auth/me is reachable; a normal action is not.
      expect((await me(tempToken)).body.mustChangePassword).toBe(true);
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(403);

      const changed = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({
          currentPassword: tempPassword,
          newPassword: 'Fresh-Doc-New-Pass1!',
        })
        .expect(200);
      const newToken = changed.body.accessToken as string;

      // old token dead, new token is a normal session
      await me(tempToken).expect(401);
      expect((await me(newToken)).body.mustChangePassword).toBe(false);
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
    });

    it('never puts the temporary password in the audit trail', async () => {
      const adminToken = await login('adminDoc');
      const created = await request(app.getHttpServer())
        .post('/clinic-admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'audit.secret@dec018.example.test', role: 'NURSE' })
        .expect(201);
      const tempPassword: string = created.body.temporaryPassword;

      const events = await prisma.auditEvent.findMany({
        where: { tenantId: tenantAId },
      });
      const serialized = JSON.stringify(events);
      expect(serialized).not.toContain(tempPassword);
      for (const banned of [
        'passwordHash',
        'temporaryPassword',
        'accessToken',
        '$2b$',
      ]) {
        expect(serialized).not.toContain(banned);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('T6 — authorization matrix', () => {
    it.each([
      ['plainDoc', 403],
      ['plainNurse', 403],
      ['plainRecep', 403],
      ['adminDoc', 200],
      ['adminNurse', 200],
      ['adminRecep', 200],
    ])('%s -> GET /clinic-admin/users == %i', async (key, expected) => {
      const token = await login(key);
      await listUsers(token).expect(expected);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T6 — tenant isolation', () => {
    it('Tenant A admin cannot read/patch/disable/reset/audit a Tenant B user (404, no leak)', async () => {
      const adminToken = await login('adminDoc');
      const bId = ids.plainDocB;

      await request(app.getHttpServer())
        .get(`/clinic-admin/users/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'NURSE' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${bId}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${bId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/clinic-admin/users/${bId}/audit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const stillB = await prisma.authUser.findUnique({ where: { id: bId } });
      expect(stillB?.role).toBe('DOCTOR');
      expect(stillB?.status).toBe('ACTIVE');
    });

    it('a spoofed tenantId in the PATCH body cannot move a user to another tenant', async () => {
      const adminToken = await login('adminDoc');
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${ids.plainNurse}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ displayName: 'X', tenantId: tenantBId })
        .expect(200);
      const after = await prisma.authUser.findUnique({
        where: { id: ids.plainNurse },
      });
      expect(after?.tenantId).toBe(tenantAId);
    });

    it('a created user is placed in the acting admin tenant', async () => {
      const adminToken = await login('adminDoc');
      const created = await request(app.getHttpServer())
        .post('/clinic-admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'tenant.scoped@dec018.example.test', role: 'DOCTOR' })
        .expect(201);
      const row = await prisma.authUser.findUnique({
        where: { id: created.body.user.id },
      });
      expect(row?.tenantId).toBe(tenantAId);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T4 — Facility / Room boundary', () => {
    it('ordinary DOCTOR POST is denied; Clinic Admin POST is allowed; reads still work', async () => {
      const plainToken = await login('plainDoc');
      const adminToken = await login('adminDoc');

      await request(app.getHttpServer())
        .post('/facilities')
        .set('Authorization', `Bearer ${plainToken}`)
        .send({ name: 'Denied Facility' })
        .expect(403);

      const facility = await request(app.getHttpServer())
        .post('/facilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'DEC-018 Synthetic Facility' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${plainToken}`)
        .send({ facilityId: facility.body.id, name: 'Denied Room' })
        .expect(403);

      const room = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ facilityId: facility.body.id, name: 'DEC-018 Synthetic Room' })
        .expect(201);

      // read regression — ordinary DOCTOR / RECEPTIONIST
      await request(app.getHttpServer())
        .get('/facilities')
        .set('Authorization', `Bearer ${plainToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/rooms?facilityId=${facility.body.id}`)
        .set('Authorization', `Bearer ${await login('plainRecep')}`)
        .expect(200);

      const events = await prisma.auditEvent.findMany({
        where: {
          tenantId: tenantAId,
          action: { in: ['FACILITY_CREATED', 'ROOM_CREATED'] },
        },
      });
      expect(events.map((e) => e.action).sort()).toEqual([
        'FACILITY_CREATED',
        'ROOM_CREATED',
      ]);
      expect(events.every((e) => e.entityId === facility.body.id || e.entityId === room.body.id)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T4 — lifecycle', () => {
    it('disable removes a DOCTOR from the selectable clinician list; reactivate is status-only', async () => {
      const adminToken = await login('adminDoc');
      const doc = await mkUser('lcDoc', tenantAId, AuthRole.DOCTOR, false);

      const before = await request(app.getHttpServer())
        .get('/clinicians')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(before.body.some((c: { id: string }) => c.id === doc.id)).toBe(true);

      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${doc.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const during = await request(app.getHttpServer())
        .get('/clinicians')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(during.body.some((c: { id: string }) => c.id === doc.id)).toBe(
        false,
      );

      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${doc.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const after = await prisma.authUser.findUnique({ where: { id: doc.id } });
      expect(after?.status).toBe('ACTIVE');
    });

    it('reactivate does NOT restore a previously revoked Clinic Admin capability', async () => {
      const adminToken = await login('adminDoc');
      const u = await mkUser('lcAdmin', tenantAId, AuthRole.DOCTOR, true);

      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${u.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isClinicAdmin: false })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${u.id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${u.id}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const row = await prisma.authUser.findUnique({ where: { id: u.id } });
      expect(row?.isClinicAdmin).toBe(false);
      expect(row?.status).toBe('ACTIVE');
    });

    it('the user-management audit endpoint returns only user-management events, in order', async () => {
      const adminToken = await login('adminDoc');
      const created = await request(app.getHttpServer())
        .post('/clinic-admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'audit.trail@dec018.example.test',
          role: 'DOCTOR',
          isClinicAdmin: true,
        })
        .expect(201);
      const id = created.body.user.id;
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'NURSE', displayName: 'Audit Trail' })
        .expect(200);

      const audit = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${id}/audit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const actions = audit.body.map((e: { action: string }) => e.action);
      expect(actions).toEqual([
        'USER_CREATED',
        'USER_CLINIC_ADMIN_GRANTED',
        'USER_PROFILE_UPDATED',
        'USER_ROLE_CHANGED',
      ]);
      const seqs = audit.body.map((e: { seq: number }) => e.seq);
      expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    });
  });

  // ---------------------------------------------------------------------------
  describe('T4 — last Clinic Admin invariant', () => {
    it('sequential: the tenant can never be reduced below one ACTIVE Clinic Admin', async () => {
      const t = await prisma.tenant.create({
        data: { name: 'DEC-018 Last-Admin Sequential Tenant' },
      });
      const a1 = await prisma.authUser.create({
        data: {
          email: 'seq.a1@dec018.example.test',
          passwordHash: await bcrypt.hash(PW, 10),
          role: AuthRole.DOCTOR,
          tenantId: t.id,
          isClinicAdmin: true,
        },
      });
      const a2 = await prisma.authUser.create({
        data: {
          email: 'seq.a2@dec018.example.test',
          passwordHash: await bcrypt.hash(PW, 10),
          role: AuthRole.NURSE,
          tenantId: t.id,
          isClinicAdmin: true,
        },
      });
      const a1Token = (
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'seq.a1@dec018.example.test', password: PW })
          .expect(200)
      ).body.accessToken;

      // revoke a2 -> ok (a1 remains)
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${a2.id}`)
        .set('Authorization', `Bearer ${a1Token}`)
        .send({ isClinicAdmin: false })
        .expect(200);

      // now revoking a1 (the last one) -> 409
      await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${a1.id}`)
        .set('Authorization', `Bearer ${a1Token}`)
        .send({ isClinicAdmin: false })
        .expect(409);

      // and disabling a1 (the last one) -> 409
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${a1.id}/disable`)
        .set('Authorization', `Bearer ${a1Token}`)
        .expect(409);

      const admins = await prisma.authUser.count({
        where: { tenantId: t.id, status: 'ACTIVE', isClinicAdmin: true },
      });
      expect(admins).toBe(1);
    });

    it('concurrent: the tenant’s two last admins each disabling themselves — at most one commits, count stays >= 1, one audit row', async () => {
      const t = await prisma.tenant.create({
        data: { name: 'DEC-018 Last-Admin Concurrent Tenant' },
      });
      const c1 = await prisma.authUser.create({
        data: {
          email: 'conc.c1@dec018.example.test',
          passwordHash: await bcrypt.hash(PW, 10),
          role: AuthRole.DOCTOR,
          tenantId: t.id,
          isClinicAdmin: true,
        },
      });
      const c2 = await prisma.authUser.create({
        data: {
          email: 'conc.c2@dec018.example.test',
          passwordHash: await bcrypt.hash(PW, 10),
          role: AuthRole.DOCTOR,
          tenantId: t.id,
          isClinicAdmin: true,
        },
      });
      const tok = async (email: string) =>
        (
          await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password: PW })
            .expect(200)
        ).body.accessToken as string;
      const c1Token = await tok('conc.c1@dec018.example.test');
      const c2Token = await tok('conc.c2@dec018.example.test');

      // Each request disables its OWN actor. The winner self-disables
      // (count 2 -> 1, allowed); the loser is still ACTIVE and its request is
      // rejected by the last-admin invariant (409) — never a fifth outcome
      // where both commit and the tenant is left with zero admins.
      const [r1, r2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/clinic-admin/users/${c1.id}/disable`)
          .set('Authorization', `Bearer ${c1Token}`),
        request(app.getHttpServer())
          .post(`/clinic-admin/users/${c2.id}/disable`)
          .set('Authorization', `Bearer ${c2Token}`),
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses[0]).toBe(200);
      expect(statuses[1]).toBe(409);

      const activeAdmins = await prisma.authUser.count({
        where: { tenantId: t.id, status: 'ACTIVE', isClinicAdmin: true },
      });
      expect(activeAdmins).toBeGreaterThanOrEqual(1);

      const disabled = await prisma.authUser.count({
        where: { tenantId: t.id, status: 'DISABLED' },
      });
      expect(disabled).toBe(1);

      const disableEvents = await prisma.auditEvent.findMany({
        where: { tenantId: t.id, action: 'USER_DISABLED' },
      });
      expect(disableEvents).toHaveLength(1);
    });
  });
});
