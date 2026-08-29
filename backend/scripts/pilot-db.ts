/**
 * Local synthetic pilot database lifecycle — Owner Synthetic Acceptance.
 *
 * WHY THIS EXISTS
 * ---------------
 * Automated E2E/tests and the manual Owner pilot must NOT share one
 * destructive database lifecycle. `backend/.env` points `DATABASE_URL` at
 * `gastrocare_foundation_test`, and every E2E suite truncates that database
 * in its own `reset()` — so any pilot data seeded there is wiped by the next
 * test run.
 *
 * This script keeps a dedicated, persistent, local **synthetic** pilot
 * database (`gastrocare_pilot`) on the SAME PostgreSQL instance. It never
 * edits `.env`: the pilot connection string is derived at run time from the
 * existing `DATABASE_URL` (same host/port/credentials, database name swapped
 * to `gastrocare_pilot`) and injected only into the child processes this
 * script spawns.
 *
 *   npm run pilot:up      # create + migrate + seed + verify (idempotent)
 *   npm run pilot:seed    # re-run the synthetic pilot seed only
 *   npm run pilot:verify  # assert the pilot synthetic accounts exist
 *   npm run pilot:start   # start the backend against the pilot database
 *   npm run pilot:psql-url # print the derived pilot DATABASE_URL (masked)
 *
 * Synthetic data only. No secrets are committed. Not for production.
 */
import { execFileSync } from 'node:child_process';
// Importing @prisma/client first triggers Prisma's automatic `.env` loading,
// so process.env.DATABASE_URL is populated before we read it below.
import { PrismaClient } from '@prisma/client';
import {
  PILOT_DOCTOR_EMAIL,
  PILOT_DOCTOR_PASSWORD,
  PILOT_RECEPTIONIST_EMAIL,
  PILOT_DOCTOR_B_EMAIL,
  PILOT_NURSE_EMAIL,
} from '../test/pilot-seed';

const PILOT_DB_NAME = 'gastrocare_pilot';

function requireBaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set (expected from backend/.env).');
  }
  return new URL(raw);
}

/** Same server + credentials as DATABASE_URL, database name -> gastrocare_pilot. */
function pilotUrl(): string {
  const url = requireBaseUrl();
  const currentDbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (currentDbName === PILOT_DB_NAME) {
    // Already a pilot URL — nothing to derive, use as-is.
    return url.toString();
  }
  url.pathname = `/${PILOT_DB_NAME}`;
  return url.toString();
}

/** Maintenance connection (database `postgres`) for CREATE DATABASE. */
function adminUrl(): string {
  const url = requireBaseUrl();
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

function mask(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.password) url.password = '***';
  return url.toString();
}

function psql(connectionString: string, sql: string): string {
  return execFileSync(
    'psql',
    [connectionString, '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
}

function ensurePilotDatabase(): void {
  const exists = psql(
    adminUrl(),
    `SELECT 1 FROM pg_database WHERE datname = '${PILOT_DB_NAME}'`,
  );
  if (exists === '1') {
    console.log(`[pilot-db] database "${PILOT_DB_NAME}" already exists.`);
    return;
  }
  psql(adminUrl(), `CREATE DATABASE "${PILOT_DB_NAME}"`);
  console.log(`[pilot-db] created database "${PILOT_DB_NAME}".`);
}

function runWithPilotEnv(command: string, args: string[]): void {
  execFileSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: pilotUrl() },
  });
}

function migratePilot(): void {
  console.log('[pilot-db] applying Prisma migrations to the pilot database...');
  runWithPilotEnv('npx', ['prisma', 'migrate', 'deploy']);
}

function seedPilot(): void {
  console.log('[pilot-db] seeding the synthetic pilot dataset...');
  runWithPilotEnv('npx', [
    'ts-node',
    '-r',
    'tsconfig-paths/register',
    'test/pilot-seed.ts',
  ]);
}

async function verifyPilot(): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: pilotUrl() } } });
  try {
    const expectedEmails = [
      PILOT_DOCTOR_EMAIL,
      PILOT_RECEPTIONIST_EMAIL,
      PILOT_DOCTOR_B_EMAIL,
      PILOT_NURSE_EMAIL,
    ];
    const users = await prisma.authUser.findMany({
      where: { email: { in: expectedEmails } },
      select: { email: true, role: true, tenantId: true },
    });
    const found = new Set(users.map((u) => u.email));
    const missing = expectedEmails.filter((e) => !found.has(e));
    const tenantIds = new Set(users.map((u) => u.tenantId));

    console.log('[pilot-db] pilot synthetic accounts:');
    for (const u of users) {
      console.log(`  - ${u.email} (${u.role}) tenant=${u.tenantId}`);
    }

    if (missing.length > 0) {
      throw new Error(
        `pilot verification FAILED — missing accounts: ${missing.join(', ')}. ` +
          `Run "npm run pilot:up".`,
      );
    }
    if (tenantIds.size !== 1) {
      throw new Error(
        `pilot verification FAILED — expected exactly one pilot tenant, saw ${tenantIds.size}.`,
      );
    }
    console.log(
      `[pilot-db] OK — 4 synthetic accounts present in one tenant (${[...tenantIds][0]}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * End-to-end smoke against the pilot database: boots the real AppModule
 * pointed at gastrocare_pilot and exercises the login + protected-endpoint
 * path over HTTP (supertest). Proves the pilot DB is a working runtime target
 * without leaving a server running.
 */
async function smokePilot(): Promise<void> {
  process.env.DATABASE_URL = pilotUrl();
  // Lazy requires so the Nest graph is only built for this subcommand.
  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const request = require('supertest');
  const { AppModule } = require('../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  try {
    const server = app.getHttpServer();

    const good = await request(server)
      .post('/auth/login')
      .send({ email: PILOT_DOCTOR_EMAIL, password: PILOT_DOCTOR_PASSWORD });
    if (good.status !== 200 || !good.body?.accessToken) {
      throw new Error(
        `pilot login FAILED — expected 200 + accessToken, got ${good.status}`,
      );
    }
    console.log('[pilot-db] smoke: correct pilot login -> 200 + JWT  OK');

    const bad = await request(server)
      .post('/auth/login')
      .send({ email: PILOT_DOCTOR_EMAIL, password: 'wrong-password' });
    if (bad.status !== 401) {
      throw new Error(
        `pilot wrong-password FAILED — expected 401, got ${bad.status}`,
      );
    }
    console.log('[pilot-db] smoke: wrong pilot password -> 401  OK');

    const protectedRes = await request(server)
      .get('/patients')
      .auth(good.body.accessToken, { type: 'bearer' });
    if (protectedRes.status !== 200 || !Array.isArray(protectedRes.body)) {
      throw new Error(
        `protected endpoint FAILED — expected 200 + array, got ${protectedRes.status}`,
      );
    }
    console.log(
      `[pilot-db] smoke: GET /patients with pilot JWT -> 200 (${protectedRes.body.length} patients)  OK`,
    );
  } finally {
    await app.close();
  }
}

function startBackend(): void {
  console.log(
    `[pilot-db] starting backend against ${mask(pilotUrl())} (Ctrl+C to stop)...`,
  );
  runWithPilotEnv('npm', ['run', 'start']);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'create':
      ensurePilotDatabase();
      break;
    case 'migrate':
      ensurePilotDatabase();
      migratePilot();
      break;
    case 'seed':
      ensurePilotDatabase();
      migratePilot();
      seedPilot();
      break;
    case 'verify':
      await verifyPilot();
      break;
    case 'smoke':
      await verifyPilot();
      await smokePilot();
      break;
    case 'up':
      ensurePilotDatabase();
      migratePilot();
      seedPilot();
      await verifyPilot();
      console.log(
        '\n[pilot-db] pilot database ready. Start the backend with:\n' +
          '  npm run pilot:start\n',
      );
      break;
    case 'start':
      startBackend();
      break;
    case 'psql-url':
      console.log(mask(pilotUrl()));
      break;
    default:
      console.error(
        'Usage: pilot-db.ts <create|migrate|seed|verify|smoke|up|start|psql-url>',
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
