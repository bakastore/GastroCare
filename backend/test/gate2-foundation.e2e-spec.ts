import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Gate 2 — Technical Foundation acceptance evidence.
 *
 * Proves, with real requests against the app (and a real disposable test
 * PostgreSQL database), that:
 *   A. Authentication works end to end.
 *   B. Protected routes require a valid authenticated identity.
 *   C. Tenant isolation is enforced at the application/service boundary,
 *      including against deliberate cross-tenant access and client-side
 *      tenantId spoofing.
 *
 * No GastroCare Core clinical entities are touched by this suite.
 */
describe('Gate 2 — Technical Foundation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  const userAPassword = 'CorrectHorseBatteryStapleA1!';
  const userBPassword = 'CorrectHorseBatteryStapleB1!';
  let probeA: { id: string; label: string };
  let probeB: { id: string; label: string };

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

    // Reset Foundation tables (disposable test DB only — see docker-compose.test.yml).
    // Also defensively clears Core clinical tables that FK-reference
    // AuthUser (clinicianAssignmentHistory/encounters) in case an earlier
    // suite in the same run left rows behind.
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

    tenantA = await prisma.tenant.create({
      data: { name: 'Foundation Test Tenant A' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'Foundation Test Tenant B' },
    });

    await prisma.authUser.create({
      data: {
        email: 'user-a@foundation-test.gastrocare.local',
        passwordHash: await bcrypt.hash(userAPassword, 10),
        tenantId: tenantA.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: 'user-b@foundation-test.gastrocare.local',
        passwordHash: await bcrypt.hash(userBPassword, 10),
        tenantId: tenantB.id,
      },
    });

    probeA = await prisma.foundationProbeRecord.create({
      data: { tenantId: tenantA.id, label: 'Tenant A probe record' },
    });
    probeB = await prisma.foundationProbeRecord.create({
      data: { tenantId: tenantB.id, label: 'Tenant B probe record' },
    });
  });

  afterAll(async () => {
    await prisma.clinicianAssignmentHistory.deleteMany();
    await prisma.encounter.deleteMany();
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
    expect(res.body.accessToken).toEqual(expect.any(String));
    return res.body.accessToken;
  }

  describe('Public route policy', () => {
    it('GET /health is reachable anonymously', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });
  });

  describe('AUTHENTICATION', () => {
    it('A. valid credentials authenticate successfully', async () => {
      await loginAs('user-a@foundation-test.gastrocare.local', userAPassword);
    });

    it('rejects invalid credentials on login itself (does not require auth to reach the route)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user-a@foundation-test.gastrocare.local',
          password: 'wrong-password',
        })
        .expect(401);
    });

    it('B. protected neutral route returns 200 for a valid authenticated identity', async () => {
      const token = await loginAs(
        'user-a@foundation-test.gastrocare.local',
        userAPassword,
      );
      const res = await request(app.getHttpServer())
        .get('/foundation/whoami')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.tenantId).toBe(tenantA.id);
    });

    it('C. protected route returns 401 with no token/identity', async () => {
      await request(app.getHttpServer()).get('/foundation/whoami').expect(401);
    });

    it('D. protected route returns 401 with an invalid/malformed token', async () => {
      await request(app.getHttpServer())
        .get('/foundation/whoami')
        .set('Authorization', 'Bearer this-is-not-a-valid-jwt')
        .expect(401);
    });

    it('E. protected route returns 401 with an expired token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'irrelevant-user-id',
          tenantId: tenantA.id,
          email: 'expired@foundation-test.gastrocare.local',
        },
        process.env.JWT_SECRET as string,
        { expiresIn: -10 },
      );
      await request(app.getHttpServer())
        .get('/foundation/whoami')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('TENANT ISOLATION', () => {
    it('A. Tenant A list query returns only Tenant A records', async () => {
      const token = await loginAs(
        'user-a@foundation-test.gastrocare.local',
        userAPassword,
      );
      const res = await request(app.getHttpServer())
        .get('/foundation/probe')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(probeA.id);
      expect(
        res.body.some((r: { tenantId: string }) => r.tenantId === tenantB.id),
      ).toBe(false);
    });

    it('B. Tenant B list query returns only Tenant B records', async () => {
      const token = await loginAs(
        'user-b@foundation-test.gastrocare.local',
        userBPassword,
      );
      const res = await request(app.getHttpServer())
        .get('/foundation/probe')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(probeB.id);
      expect(
        res.body.some((r: { tenantId: string }) => r.tenantId === tenantA.id),
      ).toBe(false);
    });

    it('C. Tenant A deliberately requesting a known Tenant B record receives no Tenant B data (404)', async () => {
      const token = await loginAs(
        'user-a@foundation-test.gastrocare.local',
        userAPassword,
      );
      const res = await request(app.getHttpServer())
        .get(`/foundation/probe/${probeB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain(probeB.label);
    });

    it('D. Tenant B cannot retrieve a known Tenant A record (404)', async () => {
      const token = await loginAs(
        'user-b@foundation-test.gastrocare.local',
        userBPassword,
      );
      const res = await request(app.getHttpServer())
        .get(`/foundation/probe/${probeA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain(probeA.label);
    });

    it('E. client-supplied tenantId spoofing cannot override authenticated tenant context', async () => {
      const token = await loginAs(
        'user-a@foundation-test.gastrocare.local',
        userAPassword,
      );
      // Tenant A user attempts to override tenant scope via a spoofed query param.
      const res = await request(app.getHttpServer())
        .get(`/foundation/probe?tenantId=${tenantB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(probeA.id);

      // Direct lookup of a Tenant B record while authenticated as Tenant A,
      // with an additional spoofed tenantId query param — still 404.
      await request(app.getHttpServer())
        .get(`/foundation/probe/${probeB.id}?tenantId=${tenantA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('F. own-tenant record remains retrievable (service/application boundary stays tenant-scoped, not just deny-all)', async () => {
      const token = await loginAs(
        'user-a@foundation-test.gastrocare.local',
        userAPassword,
      );
      const res = await request(app.getHttpServer())
        .get(`/foundation/probe/${probeA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.id).toBe(probeA.id);
    });
  });
});
