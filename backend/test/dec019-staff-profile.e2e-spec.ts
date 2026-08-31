import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, AuthUserStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * DEC-019 — Staff Profile & Credential Management v1 (e2e).
 * OWNER LOCKED — docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md.
 * Real PostgreSQL. Synthetic data only.
 *
 * Covers: T2 profile + self view, T3 credential/employment (dates, effective
 * expiry, hard-delete + audit atomicity), T4 facility assignment lifecycle +
 * partial-index concurrency, T5 audit minimization + tenant isolation.
 */
describe('DEC-019 Staff Profile & Credential Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const PW = 'Dec019-Synthetic-Pass1!';
  let tenantAId: string;
  let tenantBId: string;
  const ids: Record<string, string> = {};
  const facilities: Record<string, string> = {};

  async function resetTables() {
    await prisma.staffFacilityAssignment.deleteMany();
    await prisma.staffCredential.deleteMany();
    await prisma.employmentHistory.deleteMany();
    await prisma.staffProfile.deleteMany();
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
        email: `${key}@dec019.example.test`,
        passwordHash: await bcrypt.hash(PW, 10),
        role,
        tenantId,
        displayName: key,
        isClinicAdmin,
        status: AuthUserStatus.ACTIVE,
        mustChangePassword: false,
        sessionVersion: 0,
      },
    });
    ids[key] = u.id;
    return u;
  }

  async function login(key: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `${key}@dec019.example.test`, password: PW })
      .expect(200);
    return res.body.accessToken as string;
  }

  const H = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await resetTables();

    const a = await prisma.tenant.create({ data: { name: 'DEC-019 Tenant A' } });
    const b = await prisma.tenant.create({ data: { name: 'DEC-019 Tenant B' } });
    tenantAId = a.id;
    tenantBId = b.id;

    await mkUser('admin', tenantAId, AuthRole.DOCTOR, true);
    await mkUser('doc', tenantAId, AuthRole.DOCTOR, false);
    await mkUser('nurse', tenantAId, AuthRole.NURSE, false);
    await mkUser('adminB', tenantBId, AuthRole.DOCTOR, true);
    await mkUser('docB', tenantBId, AuthRole.DOCTOR, false);

    for (const [k, tid] of [
      ['facA1', tenantAId],
      ['facA2', tenantAId],
      ['facA3', tenantAId],
      ['facB1', tenantBId],
    ] as const) {
      const f = await prisma.facility.create({
        data: { tenantId: tid, name: k },
      });
      facilities[k] = f.id;
    }
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  // ------------------------------------------------------------------ T2
  describe('T2 — profile create/update + self view', () => {
    it('GET profile returns null before any profile exists', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .expect(200);
      expect(res.body.profile).toBeNull();
    });

    it('PUT without fullName on create is rejected 400', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({ professionalTitle: 'BS' })
        .expect(400);
    });

    it('first PUT creates; displayName is never touched; audit STAFF_PROFILE_CREATED', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({
          fullName: '  Nguyen Van A  ',
          professionalTitle: 'Bác sĩ CKI',
          primarySpecialty: 'GASTROENTEROLOGY',
          tenantId: tenantBId,
        })
        .expect(200);
      expect(res.body.fullName).toBe('Nguyen Van A');
      expect(res.body.primarySpecialty).toBe('GASTROENTEROLOGY');

      const user = await prisma.authUser.findUnique({ where: { id: ids.doc } });
      expect(user?.displayName).toBe('doc');
      const profile = await prisma.staffProfile.findFirst({
        where: { authUserId: ids.doc },
      });
      expect(profile?.tenantId).toBe(tenantAId); // spoofed tenantId ignored

      const audit = await prisma.auditEvent.findMany({
        where: { action: 'STAFF_PROFILE_CREATED' },
      });
      expect(audit).toHaveLength(1);
    });

    it('specialty invariants: duplicate / primary-in-secondary / OTHER label', async () => {
      const t = await login('admin');
      const url = `/clinic-admin/users/${ids.doc}/profile`;
      await request(app.getHttpServer())
        .put(url)
        .set(H(t))
        .send({ secondarySpecialties: ['GENERAL_SURGERY', 'GENERAL_SURGERY'] })
        .expect(400);
      await request(app.getHttpServer())
        .put(url)
        .set(H(t))
        .send({
          primarySpecialty: 'GENERAL_SURGERY',
          secondarySpecialties: ['GENERAL_SURGERY'],
        })
        .expect(400);
      await request(app.getHttpServer())
        .put(url)
        .set(H(t))
        .send({ primarySpecialty: 'OTHER' })
        .expect(400);
      const ok = await request(app.getHttpServer())
        .put(url)
        .set(H(t))
        .send({ primarySpecialty: 'OTHER', specialtyOtherLabel: 'Nội soi' })
        .expect(200);
      expect(ok.body.specialtyOtherLabel).toBe('Nội soi');
    });

    it('update writes STAFF_PROFILE_UPDATED with changedFields only (no values)', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({ biography: 'Synthetic bio text', workPhone: '0900000000' })
        .expect(200);
      const ev = await prisma.auditEvent.findFirst({
        where: { action: 'STAFF_PROFILE_UPDATED' },
        orderBy: { seq: 'desc' },
      });
      const meta = ev?.metadata as Record<string, unknown>;
      expect(meta.changedFields).toEqual(
        expect.arrayContaining(['biography', 'workPhone']),
      );
      expect(JSON.stringify(meta)).not.toContain('Synthetic bio text');
      expect(JSON.stringify(meta)).not.toContain('0900000000');
    });

    it('self view is read-only current user only; no password secrets', async () => {
      const t = await login('doc');
      const res = await request(app.getHttpServer())
        .get('/auth/me/profile')
        .set(H(t))
        .expect(200);
      expect(res.body.account.userId).toBe(ids.doc);
      expect(res.body.profile.fullName).toBe('Nguyen Van A');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|accessToken/);
      // no self-edit endpoint
      await request(app.getHttpServer())
        .put('/auth/me/profile')
        .set(H(t))
        .send({ fullName: 'x' })
        .expect(404);
    });

    it('non-admin cannot read another user full profile', async () => {
      const t = await login('doc');
      await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.nurse}/profile`)
        .set(H(t))
        .expect(403);
    });
  });

  // ------------------------------------------------------------------ T3
  describe('T3 — credentials + employment', () => {
    let credId: string;

    it('rejects expiryDate < issueDate', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .send({
          credentialType: 'LICENSE',
          name: 'CCHN',
          issueDate: '2020-05-01',
          expiryDate: '2019-05-01',
        })
        .expect(400);
    });

    it('adds ACTIVE credential; effectiveStatus ACTIVE', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .send({
          credentialType: 'LICENSE',
          name: 'CCHN',
          credentialNumber: 'SECRET-NUM-1',
          issueDate: '2020-01-01',
          expiryDate: '2999-01-01',
        })
        .expect(201);
      credId = res.body.id;
      expect(res.body.effectiveStatus).toBe('ACTIVE');
      const ev = await prisma.auditEvent.findFirst({
        where: { action: 'CREDENTIAL_ADDED' },
        orderBy: { seq: 'desc' },
      });
      expect(JSON.stringify(ev?.metadata)).not.toContain('SECRET-NUM-1');
    });

    it('expired synthetic credential shows EXPIRED without storing EXPIRED', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .send({
          credentialType: 'CERTIFICATE',
          name: 'Old cert',
          issueDate: '2010-01-01',
          expiryDate: '2011-01-01',
        })
        .expect(201);
      expect(res.body.effectiveStatus).toBe('EXPIRED');
      const row = await prisma.staffCredential.findUnique({
        where: { id: res.body.id },
      });
      expect(row?.status).toBe('ACTIVE');
    });

    it('REVOKED takes precedence over EXPIRED', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .patch(`/clinic-admin/users/${ids.doc}/credentials/${credId}`)
        .set(H(t))
        .send({ status: 'REVOKED' })
        .expect(200);
      expect(res.body.effectiveStatus).toBe('REVOKED');
    });

    it('hard delete + audit atomic', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .delete(`/clinic-admin/users/${ids.doc}/credentials/${credId}`)
        .set(H(t))
        .expect(200);
      expect(
        await prisma.staffCredential.findUnique({ where: { id: credId } }),
      ).toBeNull();
      expect(
        await prisma.auditEvent.count({
          where: { action: 'CREDENTIAL_REMOVED', entityId: credId },
        }),
      ).toBe(1);
    });

    it('overlapping employment records are both accepted', async () => {
      const t = await login('admin');
      const mk = (body: Record<string, unknown>) =>
        request(app.getHttpServer())
          .post(`/clinic-admin/users/${ids.doc}/employment-history`)
          .set(H(t))
          .send(body)
          .expect(201);
      await mk({ organizationName: 'BV A', startDate: '2018-01-01', endDate: '2022-01-01' });
      await mk({ organizationName: 'BV B', startDate: '2020-06-01' });
      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/employment-history`)
        .set(H(t))
        .expect(200);
      expect(list.body).toHaveLength(2);
    });

    it('rejects employment endDate < startDate', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/employment-history`)
        .set(H(t))
        .send({ organizationName: 'X', startDate: '2020-01-01', endDate: '2019-01-01' })
        .expect(400);
    });
  });

  // ------------------------------------------------------------------ T4
  describe('T4 — facility assignment lifecycle', () => {
    beforeAll(async () => {
      const t = await login('admin');
      // ensure nurse has a profile too
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.nurse}/profile`)
        .set(H(t))
        .send({ fullName: 'Tran Thi B' })
        .expect(200);
    });

    it('first assignment becomes primary; wrong-tenant facility → 404', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facB1, startDate: '2023-01-01' })
        .expect(404);
      const res = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA1, startDate: '2023-01-01' })
        .expect(201);
      expect(res.body.isPrimary).toBe(true);
    });

    it('duplicate active same-facility → 409', async () => {
      const t = await login('admin');
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA1, startDate: '2023-02-01' })
        .expect(409);
    });

    it('second facility secondary; switch primary keeps both active', async () => {
      const t = await login('admin');
      const second = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA2, startDate: '2023-03-01' })
        .expect(201);
      expect(second.body.isPrimary).toBe(false);

      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${second.body.id}`,
        )
        .set(H(t))
        .send({ makePrimary: true })
        .expect(200);

      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .expect(200);
      const active = list.body.filter((a: { active: boolean }) => a.active);
      expect(active).toHaveLength(2);
      expect(active.filter((a: { isPrimary: boolean }) => a.isPrimary)).toHaveLength(1);
    });

    it('ending current primary requires replacement when other active remains', async () => {
      const t = await login('admin');
      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .expect(200);
      const primary = list.body.find((a: { isPrimary: boolean; active: boolean }) => a.isPrimary && a.active);
      const other = list.body.find(
        (a: { id: string; active: boolean; isPrimary: boolean }) =>
          a.active && !a.isPrimary,
      );
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({ end: true })
        .expect(400);
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({ end: true, replacementPrimaryAssignmentId: other.id })
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .expect(200);
      const activeAfter = after.body.filter((a: { active: boolean }) => a.active);
      expect(activeAfter).toHaveLength(1);
      expect(activeAfter[0].id).toBe(other.id);
      expect(activeAfter[0].isPrimary).toBe(true);
      // ended row cannot be reopened / made primary
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({ makePrimary: true })
        .expect(400);
    });

    it('ended facility (facA2) permits later rejoin as a new row', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA2, startDate: '2024-01-01' })
        .expect(201);
      expect(res.body.facilityId).toBe(facilities.facA2);
      expect(res.body.isPrimary).toBe(false); // facA1 is still the active primary
    });

    it('ending the last primary with no other active leaves primary count 0', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.nurse}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA3, startDate: '2023-01-01' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.nurse}/facility-assignments/${res.body.id}`,
        )
        .set(H(t))
        .send({ end: true })
        .expect(200);
      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.nurse}/facility-assignments`)
        .set(H(t))
        .expect(200);
      expect(list.body.filter((a: { active: boolean }) => a.active)).toHaveLength(0);
    });

    it('concurrent competing primary changes never yield two active primaries', async () => {
      const t = await login('admin');
      // fresh profile with 3 active assignments
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({ fullName: 'Nguyen Van A' })
        .expect(200);
      const p = await prisma.staffProfile.findFirst({
        where: { authUserId: ids.doc },
      });
      // wipe assignments for a clean slate
      await prisma.staffFacilityAssignment.deleteMany({
        where: { staffProfileId: p!.id },
      });
      const a1 = await prisma.staffFacilityAssignment.create({
        data: {
          tenantId: tenantAId,
          staffProfileId: p!.id,
          facilityId: facilities.facA1,
          isPrimary: true,
          startDate: new Date('2025-01-01T00:00:00Z'),
        },
      });
      const a2 = await prisma.staffFacilityAssignment.create({
        data: {
          tenantId: tenantAId,
          staffProfileId: p!.id,
          facilityId: facilities.facA2,
          isPrimary: false,
          startDate: new Date('2025-01-01T00:00:00Z'),
        },
      });
      const a3 = await prisma.staffFacilityAssignment.create({
        data: {
          tenantId: tenantAId,
          staffProfileId: p!.id,
          facilityId: facilities.facA3,
          isPrimary: false,
          startDate: new Date('2025-01-01T00:00:00Z'),
        },
      });

      const results = await Promise.allSettled([
        request(app.getHttpServer())
          .patch(`/clinic-admin/users/${ids.doc}/facility-assignments/${a2.id}`)
          .set(H(t))
          .send({ makePrimary: true }),
        request(app.getHttpServer())
          .patch(`/clinic-admin/users/${ids.doc}/facility-assignments/${a3.id}`)
          .set(H(t))
          .send({ makePrimary: true }),
      ]);
      const codes = results.map((r) =>
        r.status === 'fulfilled' ? r.value.status : 0,
      );
      // at least one succeeds; any loser is 409, never a 500
      expect(codes).toEqual(expect.arrayContaining([200]));
      expect(codes.every((c) => c === 200 || c === 409)).toBe(true);

      const activePrimaries = await prisma.staffFacilityAssignment.count({
        where: { staffProfileId: p!.id, endDate: null, isPrimary: true },
      });
      expect(activePrimaries).toBe(1);
      void a1;
    });
  });

  // ---------------------------------------------------- T7 F1 (HIGH) concurrency
  describe('T7-F1 — facility-assignment invariant under concurrency', () => {
    async function freshProfileWithAssignments(count: 1 | 2 | 3) {
      const t = await login('admin');
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({ fullName: 'Nguyen Van A' })
        .expect(200);
      const p = await prisma.staffProfile.findFirst({
        where: { authUserId: ids.doc },
      });
      await prisma.staffFacilityAssignment.deleteMany({
        where: { staffProfileId: p!.id },
      });
      const facs = [facilities.facA1, facilities.facA2, facilities.facA3];
      const rows: { id: string }[] = [];
      for (let i = 0; i < count; i++) {
        rows.push(
          await prisma.staffFacilityAssignment.create({
            data: {
              tenantId: tenantAId,
              staffProfileId: p!.id,
              facilityId: facs[i],
              isPrimary: i === 0,
              startDate: new Date('2025-01-01T00:00:00Z'),
            },
          }),
        );
      }
      return { t, profileId: p!.id, rows };
    }

    async function assertInvariant(profileId: string) {
      const active = await prisma.staffFacilityAssignment.count({
        where: { staffProfileId: profileId, endDate: null },
      });
      const primaries = await prisma.staffFacilityAssignment.count({
        where: { staffProfileId: profileId, endDate: null, isPrimary: true },
      });
      if (active > 0) expect(primaries).toBe(1);
      else expect(primaries).toBe(0);
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /** Hold the per-StaffProfile FOR UPDATE lock, run `mutate` while it is
     *  held (simulating a competing transaction that "wins first"), then
     *  release so a request already blocked on the lock proceeds. */
    async function whileHoldingProfileLock(
      profileId: string,
      mutate: (tx: Prisma.TransactionClient) => Promise<void>,
    ): Promise<{ release: () => void; done: Promise<unknown> }> {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const done = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM staff_profiles WHERE id = ${profileId} FOR UPDATE`;
          await sleep(120); // let the blocked request finish its pre-read
          await mutate(tx);
          await gate;
        },
        { timeout: 15000 },
      );
      return { release, done };
    }

    async function facAuditCount(profileId: string) {
      return prisma.auditEvent.count({
        where: {
          action: { startsWith: 'FACILITY_ASSIGNMENT_' },
          metadata: { path: ['staffProfileId'], equals: profileId },
        },
      });
    }

    it('A — end(secondary target) that is promoted to primary while awaiting the lock returns 409, never 400', async () => {
      const { t, profileId, rows } = await freshProfileWithAssignments(3);
      const target = rows[1]; // secondary at submission — no replacement required
      const auditBefore = await facAuditCount(profileId);

      const holder = await whileHoldingProfileLock(profileId, async (tx) => {
        await tx.staffFacilityAssignment.updateMany({
          where: { staffProfileId: profileId, endDate: null, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.staffFacilityAssignment.update({
          where: { id: target.id },
          data: { isPrimary: true },
        });
      });

      // .then() dispatches the request NOW so its pre-read runs while the lock
      // is still held; .ok() stops supertest throwing on the expected 409.
      const endResP = request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${target.id}`,
        )
        .set(H(t))
        .send({ end: true }) // no replacement — valid when submitted
        .ok(() => true)
        .then((r) => r);

      await sleep(300);
      holder.release();
      await holder.done;

      const res = await endResP;
      expect(res.status).toBe(409); // NOT 400
      await assertInvariant(profileId);
      // failed stale mutation writes NO AuditEvent
      expect(
        await prisma.auditEvent.count({
          where: { action: 'FACILITY_ASSIGNMENT_ENDED', entityId: target.id },
        }),
      ).toBe(0);
      expect(await facAuditCount(profileId)).toBe(auditBefore);
    });

    it('A2 — end(sole primary) that becomes replacement-required via a concurrent create returns 409, never 400', async () => {
      const { t, profileId, rows } = await freshProfileWithAssignments(1);
      const sole = rows[0]; // sole active primary — no replacement required at submission
      const auditBefore = await facAuditCount(profileId);

      const holder = await whileHoldingProfileLock(profileId, async (tx) => {
        await tx.staffFacilityAssignment.create({
          data: {
            tenantId: tenantAId,
            staffProfileId: profileId,
            facilityId: facilities.facA2,
            isPrimary: false,
            startDate: new Date('2025-04-01T00:00:00Z'),
          },
        });
      });

      const endResP = request(app.getHttpServer())
        .patch(`/clinic-admin/users/${ids.doc}/facility-assignments/${sole.id}`)
        .set(H(t))
        .send({ end: true }) // no replacement — valid when submitted
        .ok(() => true)
        .then((r) => r);

      await sleep(300);
      holder.release();
      await holder.done;

      const res = await endResP;
      expect(res.status).toBe(409); // NOT 400
      await assertInvariant(profileId);
      expect(
        await prisma.auditEvent.count({
          where: { action: 'FACILITY_ASSIGNMENT_ENDED', entityId: sole.id },
        }),
      ).toBe(0);
      expect(await facAuditCount(profileId)).toBe(auditBefore);
    });

    it('A3 — supplied replacement that is ended while awaiting the lock returns 409, never 400', async () => {
      const { t, profileId, rows } = await freshProfileWithAssignments(2);
      const [primary, replacement] = rows;

      const holder = await whileHoldingProfileLock(profileId, async (tx) => {
        await tx.staffFacilityAssignment.update({
          where: { id: replacement.id },
          data: { endDate: new Date('2025-05-01T00:00:00Z') },
        });
      });

      const endResP = request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({ end: true, replacementPrimaryAssignmentId: replacement.id })
        .ok(() => true)
        .then((r) => r);

      await sleep(300);
      holder.release();
      await holder.done;

      const res = await endResP;
      expect(res.status).toBe(409); // NOT 400 — replacement was valid at submission
      await assertInvariant(profileId);
    });

    it('A4 — deterministic: end(primary) with other actives and no replacement is still 400', async () => {
      const { t, profileId } = await freshProfileWithAssignments(3);
      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .expect(200);
      const primary = list.body.find(
        (a: { isPrimary: boolean; active: boolean }) => a.isPrimary && a.active,
      );
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({ end: true })
        .expect(400); // required from the outset, not a race
      await assertInvariant(profileId);
    });

    it('A5 — deterministic: bogus replacement id is 400, not 409', async () => {
      const { t } = await freshProfileWithAssignments(3);
      const list = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .expect(200);
      const primary = list.body.find(
        (a: { isPrimary: boolean; active: boolean }) => a.isPrimary && a.active,
      );
      await request(app.getHttpServer())
        .patch(
          `/clinic-admin/users/${ids.doc}/facility-assignments/${primary.id}`,
        )
        .set(H(t))
        .send({
          end: true,
          replacementPrimaryAssignmentId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(400);
    });

    it('B — competing primary changes still leave exactly one active primary', async () => {
      const { t, profileId, rows } = await freshProfileWithAssignments(3);
      const results = await Promise.allSettled([
        request(app.getHttpServer())
          .patch(
            `/clinic-admin/users/${ids.doc}/facility-assignments/${rows[1].id}`,
          )
          .set(H(t))
          .send({ makePrimary: true }),
        request(app.getHttpServer())
          .patch(
            `/clinic-admin/users/${ids.doc}/facility-assignments/${rows[2].id}`,
          )
          .set(H(t))
          .send({ makePrimary: true }),
      ]);
      const codes = results.map((r) =>
        r.status === 'fulfilled' ? r.value.status : 0,
      );
      expect(codes).toEqual(expect.arrayContaining([200]));
      expect(codes.every((c) => c === 200 || c === 409)).toBe(true);
      await assertInvariant(profileId);
    });

    it('C — create concurrent with make-primary: invariant holds across both paths', async () => {
      const { t, profileId, rows } = await freshProfileWithAssignments(2);
      // free facA3 so the concurrent create can use it
      const results = await Promise.allSettled([
        request(app.getHttpServer())
          .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
          .set(H(t))
          .send({
            facilityId: facilities.facA3,
            startDate: '2025-02-01',
            makePrimary: true,
          }),
        request(app.getHttpServer())
          .patch(
            `/clinic-admin/users/${ids.doc}/facility-assignments/${rows[1].id}`,
          )
          .set(H(t))
          .send({ makePrimary: true }),
      ]);
      const codes = results.map((r) =>
        r.status === 'fulfilled' ? r.value.status : 0,
      );
      expect(codes.every((c) => [200, 201, 409].includes(c))).toBe(true);
      expect(codes).not.toContain(500);
      await assertInvariant(profileId);
    });

    it('E — partial unique indexes still reject a second active primary / duplicate active facility', async () => {
      const { profileId, rows } = await freshProfileWithAssignments(2);
      await expect(
        prisma.staffFacilityAssignment.update({
          where: { id: rows[1].id },
          data: { isPrimary: true },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.staffFacilityAssignment.create({
          data: {
            tenantId: tenantAId,
            staffProfileId: profileId,
            facilityId: facilities.facA1,
            isPrimary: false,
            startDate: new Date('2025-03-01T00:00:00Z'),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  // ---------------------------------------------------- T7 F2 (MEDIUM) dates
  describe('T7-F2 — strict calendar date validation', () => {
    let t: string;
    beforeAll(async () => {
      t = await login('admin');
      await request(app.getHttpServer())
        .put(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .send({ fullName: 'Nguyen Van A' })
        .expect(200);
    });

    const REJECT = [
      '2026-02-29',
      '2026-02-30',
      '2026-02-31',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
    ];
    const ACCEPT = ['2024-02-29', '2026-02-28', '2026-01-31', '2026-12-31'];

    it.each(REJECT)('rejects impossible credential issueDate %s', async (d) => {
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .send({ credentialType: 'LICENSE', name: 'X', issueDate: d })
        .expect(400);
    });

    it.each(ACCEPT)('accepts valid credential issueDate %s', async (d) => {
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .send({ credentialType: 'LICENSE', name: 'X', issueDate: d })
        .expect(201);
    });

    it('rejects impossible employment startDate and facility-assignment startDate', async () => {
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/employment-history`)
        .set(H(t))
        .send({ organizationName: 'O', startDate: '2026-02-31' })
        .expect(400);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA1, startDate: '2025-13-01' })
        .expect(400);
    });
  });

  // ------------------------------------------------------------------ T5
  describe('T5 — audit + tenant isolation', () => {
    it('staff-audit returns DEC-019 events ordered by seq for the target', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/staff-audit`)
        .set(H(t))
        .expect(200);
      const seqs = res.body.map((e: { seq: number }) => e.seq);
      expect([...seqs].sort((x, y) => x - y)).toEqual(seqs);
      expect(
        res.body.every((e: { action: string }) => e.action.startsWith('STAFF_') || e.action.startsWith('CREDENTIAL_') || e.action.startsWith('EMPLOYMENT_') || e.action.startsWith('FACILITY_')),
      ).toBe(true);
    });

    it('DEC-018 user audit endpoint is unchanged (no DEC-019 actions leak in)', async () => {
      const t = await login('admin');
      const res = await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/audit`)
        .set(H(t))
        .expect(200);
      expect(
        res.body.some((e: { action: string }) =>
          e.action.startsWith('CREDENTIAL_'),
        ),
      ).toBe(false);
    });

    it('Tenant B admin cannot read/list/create Tenant A staff data (404 non-leak)', async () => {
      const t = await login('adminB');
      await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/profile`)
        .set(H(t))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/clinic-admin/users/${ids.doc}/credentials`)
        .set(H(t))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/clinic-admin/users/${ids.doc}/facility-assignments`)
        .set(H(t))
        .send({ facilityId: facilities.facA1, startDate: '2023-01-01' })
        .expect(404);
    });
  });
});
