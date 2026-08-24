import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, CareEpisodeStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CORE-04 T1 — CareEpisode + Encounter clinical time (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let patientA1Id: string;
  let patientA2Id: string;
  let patientBId: string;
  let doctorAToken: string;
  let doctorBToken: string;
  let receptionistAToken: string;
  let episodeAId: string;

  const occurredAt = '2026-08-23T04:15:30.000Z';

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

    const tenantA = await prisma.tenant.create({
      data: { name: 'CORE-04 T1 Synthetic Tenant A' },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: 'CORE-04 T1 Synthetic Tenant B' },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const doctorAPassword = 'Core04T1-DoctorA-Pass1!';
    const doctorBPassword = 'Core04T1-DoctorB-Pass1!';
    const receptionistAPassword = 'Core04T1-ReceptionA-Pass1!';

    await prisma.authUser.createMany({
      data: [
        {
          email: 'doctor-a@core04-t1.example.test',
          passwordHash: await bcrypt.hash(doctorAPassword, 10),
          role: AuthRole.DOCTOR,
          tenantId: tenantAId,
        },
        {
          email: 'doctor-b@core04-t1.example.test',
          passwordHash: await bcrypt.hash(doctorBPassword, 10),
          role: AuthRole.DOCTOR,
          tenantId: tenantBId,
        },
        {
          email: 'reception-a@core04-t1.example.test',
          passwordHash: await bcrypt.hash(receptionistAPassword, 10),
          role: AuthRole.RECEPTIONIST,
          tenantId: tenantAId,
        },
      ],
    });

    const [patientA1, patientA2, patientB] = await Promise.all([
      prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Patient A One',
          normalizedFullName: 'synthetic patient a one',
          dateOfBirth: new Date('1980-01-01'),
          gender: 'MALE',
          phone: '0900000401',
          normalizedPhone: '0900000401',
        },
      }),
      prisma.patient.create({
        data: {
          tenantId: tenantAId,
          fullName: 'Synthetic Patient A Two',
          normalizedFullName: 'synthetic patient a two',
          dateOfBirth: new Date('1981-01-01'),
          gender: 'FEMALE',
          phone: '0900000402',
          normalizedPhone: '0900000402',
        },
      }),
      prisma.patient.create({
        data: {
          tenantId: tenantBId,
          fullName: 'Synthetic Patient B',
          normalizedFullName: 'synthetic patient b',
          dateOfBirth: new Date('1982-01-01'),
          gender: 'OTHER',
          phone: '0900000403',
          normalizedPhone: '0900000403',
        },
      }),
    ]);
    patientA1Id = patientA1.id;
    patientA2Id = patientA2.id;
    patientBId = patientB.id;

    doctorAToken = await login(
      'doctor-a@core04-t1.example.test',
      doctorAPassword,
    );
    doctorBToken = await login(
      'doctor-b@core04-t1.example.test',
      doctorBPassword,
    );
    receptionistAToken = await login(
      'reception-a@core04-t1.example.test',
      receptionistAPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('creates an ACTIVE LONGO_TREATMENT CareEpisode for a same-tenant patient', async () => {
    const response = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA1Id,
        episodeType: 'LONGO_TREATMENT',
        startedAt: '2026-08-20T02:00:00.000Z',
      })
      .expect(201);

    episodeAId = response.body.id as string;
    expect(response.body).toMatchObject({
      tenantId: tenantAId,
      patientId: patientA1Id,
      episodeType: 'LONGO_TREATMENT',
      status: CareEpisodeStatus.ACTIVE,
      endedAt: null,
    });

    const list = await request(app.getHttpServer())
      .get(`/patients/${patientA1Id}/care-episodes`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .expect(200);
    expect(list.body.map((episode: { id: string }) => episode.id)).toContain(
      episodeAId,
    );
  });

  it('rejects CareEpisode creation for a patient in another tenant', async () => {
    await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientBId,
        episodeType: 'LONGO_TREATMENT',
        startedAt: '2026-08-20T02:00:00.000Z',
      })
      .expect(404);
  });

  it('enforces the v1 episodeType allow-list and DOCTOR-only RBAC', async () => {
    await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA1Id,
        episodeType: 'UNAPPROVED_TYPE',
        startedAt: '2026-08-20T02:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/care-episodes/${episodeAId}`)
      .set('Authorization', `Bearer ${receptionistAToken}`)
      .expect(403);
  });

  it('creates an Encounter linked to an Episode with the same tenant and patient', async () => {
    const response = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA1Id,
        episodeId: episodeAId,
        occurredAt,
        reasonForVisit: 'Synthetic T1 encounter',
        clinicalNote: 'Synthetic note',
        assessment: 'Synthetic assessment',
      })
      .expect(201);

    expect(response.body.episodeId).toBe(episodeAId);
    expect(response.body.occurredAt).toBe(occurredAt);
  });

  it('rejects an Encounter linked to an Episode belonging to another patient', async () => {
    await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA2Id,
        episodeId: episodeAId,
        occurredAt,
        reasonForVisit: 'Synthetic cross-patient attempt',
        clinicalNote: 'Synthetic note',
        assessment: 'Synthetic assessment',
      })
      .expect(400);
  });

  it('rejects an Encounter linked to an Episode in another tenant', async () => {
    await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({
        patientId: patientBId,
        episodeId: episodeAId,
        occurredAt,
        reasonForVisit: 'Synthetic cross-tenant attempt',
        clinicalNote: 'Synthetic note',
        assessment: 'Synthetic assessment',
      })
      .expect(404);
  });

  it('persists exactly the client-supplied occurredAt clinical time', async () => {
    const stored = await prisma.encounter.findFirstOrThrow({
      where: { tenantId: tenantAId, episodeId: episodeAId },
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.occurredAt.toISOString()).toBe(occurredAt);
    expect(stored.occurredAt.getTime()).not.toBe(stored.createdAt.getTime());
  });

  it('rejects Encounter creation when occurredAt is missing', async () => {
    await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA1Id,
        reasonForVisit: 'Synthetic missing clinical time',
        clinicalNote: 'Synthetic note',
        assessment: 'Synthetic assessment',
      })
      .expect(400);
  });

  it('allows a generic Core Encounter with episodeId omitted', async () => {
    const response = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({
        patientId: patientA1Id,
        occurredAt: '2026-08-22T03:00:00.000Z',
        reasonForVisit: 'Synthetic ungrouped encounter',
        clinicalNote: 'Synthetic note',
        assessment: 'Synthetic assessment',
      })
      .expect(201);
    expect(response.body.episodeId).toBeNull();
  });

  it('closes an ACTIVE Episode and sets endedAt using server time', async () => {
    const before = Date.now();
    const response = await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/close`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .expect(201);
    const after = Date.now();

    expect(response.body.status).toBe(CareEpisodeStatus.CLOSED);
    const endedAt = new Date(response.body.endedAt as string).getTime();
    expect(endedAt).toBeGreaterThanOrEqual(before);
    expect(endedAt).toBeLessThanOrEqual(after);
  });

  it('rejects closing an already CLOSED Episode', async () => {
    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/close`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .expect(409);
  });

  it('rejects reopening without a non-blank reason', async () => {
    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/reopen`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/reopen`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({ reason: '   ' })
      .expect(400);
  });

  it('reopens a CLOSED Episode, clears endedAt, and preserves the ACTIVE invariant', async () => {
    const response = await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/reopen`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({ reason: 'Synthetic lifecycle correction' })
      .expect(201);

    expect(response.body.status).toBe(CareEpisodeStatus.ACTIVE);
    expect(response.body.endedAt).toBeNull();

    const invalidActiveCount = await prisma.careEpisode.count({
      where: { status: CareEpisodeStatus.ACTIVE, endedAt: { not: null } },
    });
    expect(invalidActiveCount).toBe(0);
  });

  it('rejects reopening an already ACTIVE Episode', async () => {
    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/reopen`)
      .set('Authorization', `Bearer ${doctorAToken}`)
      .send({ reason: 'Synthetic duplicate transition' })
      .expect(409);
  });

  it('rejects cross-tenant Episode reads and lifecycle writes', async () => {
    await request(app.getHttpServer())
      .get(`/care-episodes/${episodeAId}`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/close`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/care-episodes/${episodeAId}/reopen`)
      .set('Authorization', `Bearer ${doctorBToken}`)
      .send({ reason: 'Synthetic cross-tenant attempt' })
      .expect(404);
  });

  it('writes the three required lifecycle AuditEvents without clinical content', async () => {
    // Ordered by `seq` (DB-assigned monotonic append sequence), not
    // `createdAt` — createdAt is wall-clock and cannot be relied on for
    // strict ordering (same-timestamp collisions, clock granularity/skew,
    // restore/replay). `seq` is the deterministic causal-order column
    // (CORE-04 T16 remediation R1; see AuditEvent.seq in schema.prisma).
    const events = await prisma.auditEvent.findMany({
      where: { tenantId: tenantAId, entityId: episodeAId },
      orderBy: { seq: 'asc' },
    });
    expect(events.map((event) => event.action)).toEqual([
      'CARE_EPISODE_STARTED',
      'CARE_EPISODE_CLOSED',
      'CARE_EPISODE_REOPENED',
    ]);
    expect(JSON.stringify(events)).not.toContain('Synthetic note');
  });

  it('has no NULL occurredAt rows and no migration backfill from persistence time', async () => {
    const nullRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "encounters"
      WHERE "occurredAt" IS NULL
    `;
    expect(nullRows[0].count).toBe(0n);

    const migrationFiles = [
      join(
        __dirname,
        '../prisma/migrations/20260823090000_core04_t1_expand/migration.sql',
      ),
      join(
        __dirname,
        '../prisma/migrations/20260823090100_core04_t1_contract/migration.sql',
      ),
    ];
    const sql = migrationFiles
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(sql).not.toMatch(
      /UPDATE\s+"?encounters"?[\s\S]*?SET\s+"?occurredAt"?\s*=\s*"?createdAt"?/i,
    );
  });
});
