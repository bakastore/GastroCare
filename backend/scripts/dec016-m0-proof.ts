/** M0 proof — fixed disposable database only. Never resets the dev database. */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { reconcile, ReconciliationManifest } from './dec016-reconcile';

const container = 'gastrocare_foundation_test_db';
const db = 'gastrocare_dec016_rehearsal';
const dir = `/tmp/gastrocare-dec016-m0-${Date.now()}`;
const backend = join(__dirname, '..');
const baselineHead = 'c0dfe1a4f774bef334dd2c2e0eac45f89a2e106b';
process.env.DATABASE_URL = `postgresql://gastrocare_test:gastrocare_test@localhost:55432/${db}?schema=public`;
const docker = (args: string[], input?: string | Buffer) =>
  execFileSync('docker', args, { input, maxBuffer: 32 * 1024 * 1024 });
const sql = (query: string, target = db) =>
  docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'gastrocare_test',
      '-d',
      target,
    ],
    query,
  )
    .toString()
    .trim();
const hash = (v: string | Buffer) =>
  createHash('sha256').update(v).digest('hex');
const uid = (n: number) =>
  `d0160000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [
  tenantId,
  actorId,
  patientId,
  caseId,
  legacyId,
  A,
  B,
  C,
  D,
  E,
  pathwayId,
] = Array.from({ length: 11 }, (_, i) => uid(i + 1));
const t = '2026-08-01T01:02:03.456Z';
const manifest: ReconciliationManifest = {
  authority: 'DEC-016',
  syntheticOnly: true,
  id: 'dec016-run2-rehearsal',
  appliedAt: '2026-08-28T00:00:00.000Z',
  entries: [
    {
      tenantId,
      actorId,
      patientId,
      caseId,
      initialEncounterIds: [A],
      legacyPathways: [
        { legacyEpisodeId: legacyId, pathwayId, encounterIds: [C] },
      ],
    },
  ],
};
const baselineTables = [
  'tenants',
  'auth_users',
  'patients',
  'care_episodes',
  'encounters',
  'clinical_form_submissions',
  'care_plans',
  'care_plan_versions',
  'care_tasks',
  'clinician_assignment_history',
  'audit_events',
];
const newTables = [
  'treatment_pathways',
  'investigations',
  'investigation_orders',
  'investigation_results',
];
function snapshot(tables: string[]) {
  return Object.fromEntries(
    tables.map((table) => [
      table,
      JSON.parse(
        sql(
          `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') FROM ${table} t;`,
        ),
      ),
    ]),
  );
}
function dump() {
  return docker([
    'exec',
    container,
    'pg_dump',
    '-U',
    'gastrocare_test',
    '-d',
    db,
    '-Fc',
    '--no-owner',
  ]);
}
function drop() {
  sql(`DROP DATABASE "${db}" WITH (FORCE);`, 'postgres');
}
function create() {
  sql(`CREATE DATABASE "${db}";`, 'postgres');
}
function migrate() {
  execFileSync(
    join(backend, 'node_modules/.bin/prisma'),
    ['migrate', 'deploy'],
    { cwd: backend, env: process.env, stdio: 'pipe' },
  );
}
async function main() {
  assert.equal(
    sql(`SELECT count(*) FROM pg_database WHERE datname='${db}';`, 'postgres'),
    '0',
    'STOP: rehearsal DB already exists; preserve it',
  );
  mkdirSync(dir, { mode: 0o700 });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  // Reconstruct PRE from the immutable accepted Git baseline. This proof
  // remains repeatable after the local dev DB has migrated, without reading
  // or resetting its data. Never run migrate reset on the dev database.
  const git = (args: string[]) => execFileSync('git', args, { cwd: backend });
  assert.equal(
    git(['rev-parse', 'HEAD']).toString().trim(),
    baselineHead,
    'STOP: unexpected baseline drift',
  );
  const baselineRoot = join(dir, 'baseline');
  const files = [
    'backend/prisma/schema.prisma',
    ...git([
      'ls-tree',
      '-r',
      '--name-only',
      baselineHead,
      '--',
      'prisma/migrations',
    ])
      .toString()
      .trim()
      .split('\n')
      .map((p) => `backend/${p}`),
  ];
  assert.equal(files.filter((p) => p.endsWith('/migration.sql')).length, 10);
  assert.ok(files.some((p) => p.includes('dec015_encounter_workflow_kind')));
  const baselineChecksums: Record<string, string> = {};
  for (const file of files) {
    const bytes = git(['show', `${baselineHead}:${file}`]);
    const target = join(baselineRoot, file);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, bytes);
    baselineChecksums[file] = hash(bytes);
  }
  assert.ok(
    docker(['port', container, '5432/tcp']).toString().includes(':55432'),
    'STOP: unexpected local database port',
  );
  create();
  execFileSync(
    join(backend, 'node_modules/.bin/prisma'),
    [
      'migrate',
      'deploy',
      '--schema',
      join(baselineRoot, 'backend/prisma/schema.prisma'),
    ],
    { cwd: backend, env: process.env, stdio: 'pipe' },
  );
  // SQL fixture is deliberately PRE schema. IDs carry all mapping authority;
  // reason/name/time values are never used to choose or group any row.
  sql(`INSERT INTO tenants(id,name) VALUES ('${tenantId}','DEC-016 SYNTHETIC M0');
    INSERT INTO auth_users(id,email,"passwordHash",role,"tenantId") VALUES ('${actorId}','m0@example.test','not-a-login','DOCTOR','${tenantId}');
    INSERT INTO patients(id,"tenantId","fullName","normalizedFullName","dateOfBirth",gender,phone,"normalizedPhone","updatedAt") VALUES
    ('${patientId}','${tenantId}','SYNTHETIC M0','synthetic m0','1990-01-01','OTHER','0000000000','0000000000','${t}');
    INSERT INTO care_episodes(id,"tenantId","patientId","episodeType","startedAt","createdAt") VALUES
    ('${caseId}','${tenantId}','${patientId}','HEMORRHOID_TREATMENT','${t}','${t}'),
    ('${legacyId}','${tenantId}','${patientId}','LONGO_TREATMENT','${t}','${t}');
    INSERT INTO encounters(id,"tenantId","patientId","episodeId","responsibleClinicianId","createdByUserId","reasonForVisit","occurredAt","createdAt","workflowKind") VALUES
    ${[A, B, C, D, E].map((id, i) => `('${id}','${tenantId}','${patientId}',${i === 2 ? `'${legacyId}'` : i >= 3 ? `'${caseId}'` : 'NULL'},'${actorId}','${actorId}','synthetic trĩ same text','${t}','${t}',${i === 0 ? "'HEMORRHOID_INITIAL'" : 'NULL'})`).join(',')};
    INSERT INTO clinical_form_submissions(id,"tenantId","patientId","encounterId","templateKey","templateVersion",status,responses,"actorId","logicalGroupId","revisionNumber","completedByUserId","completedAt","updatedAt","createdAt") VALUES
    ('${uid(20)}','${tenantId}','${patientId}','${C}','LONGO_PREOP_ASSESSMENT',1,'COMPLETED','{}','${actorId}','${uid(20)}',1,'${actorId}','${t}','${t}','${t}');
    INSERT INTO clinical_form_submissions(id,"tenantId","patientId","encounterId","templateKey","templateVersion",status,responses,"actorId","logicalGroupId","revisionNumber","previousSubmissionId","amendmentReason","amendedByUserId","completedByUserId","completedAt","updatedAt","createdAt") VALUES
    ('${uid(21)}','${tenantId}','${patientId}','${C}','LONGO_PREOP_ASSESSMENT',1,'COMPLETED','{}','${actorId}','${uid(20)}',2,'${uid(20)}','synthetic correction','${actorId}','${actorId}','${t}','${t}','${t}');
    INSERT INTO care_plans(id,"tenantId","encounterId","patientId",status,instructions,"createdAt","updatedAt") VALUES
    ('${uid(22)}','${tenantId}','${A}','${patientId}','SIGNED','synthetic historical plan','${t}','${t}');
    INSERT INTO care_plan_versions(id,"tenantId","carePlanId","versionNumber",instructions,"actorId","signedAt") VALUES
    ('${uid(23)}','${tenantId}','${uid(22)}',1,'synthetic historical plan','${actorId}','${t}');
    UPDATE care_plans SET "currentVersionId"='${uid(23)}' WHERE id='${uid(22)}';
    INSERT INTO care_tasks(id,"tenantId","patientId","carePlanId",status,"dueDate","completedAt","completedByEncounterId","createdAt") VALUES
    ('${uid(24)}','${tenantId}','${patientId}','${uid(22)}','COMPLETED','${t}','${t}','${D}','${t}');
    INSERT INTO clinician_assignment_history(id,"tenantId","encounterId","clinicianId","assignedByUserId","assignedAt") VALUES
    ('${uid(25)}','${tenantId}','${C}','${actorId}','${actorId}','${t}');
    INSERT INTO audit_events(id,"tenantId","actorId",action,"entityType","entityId","createdAt") VALUES
    ('${uid(26)}','${tenantId}','${actorId}','ENCOUNTER_CREATED','Encounter','${C}','${t}');`);
  const pre = snapshot(baselineTables);
  const preMigrations = sql(
    'SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM _prisma_migrations t;',
  );
  const backup = dump();
  writeFileSync(join(dir, 'pre.dump'), backup, { mode: 0o600 });
  writeFileSync(join(dir, 'pre.sha256'), hash(backup));
  writeFileSync(join(dir, 'pre-signatures.json'), JSON.stringify(pre));
  migrate();
  let prisma = new PrismaClient();
  await reconcile(prisma, manifest);
  const post = snapshot([...baselineTables, ...newTables]);
  // Every original row must be byte-equivalent after only the declared two
  // ancestry deltas; no fabricated diagnoses/decisions/plans/tasks/forms.
  for (const table of baselineTables) {
    const actual = structuredClone(post[table]);
    if (table === 'encounters')
      for (const row of actual) {
        if (row.id === A) row.episodeId = null;
        if (row.id === C) row.episodeId = legacyId;
        delete row.treatmentPathwayId;
      }
    if (table === 'audit_events')
      actual.splice(
        actual.findIndex((r: any) => r.id === `${manifest.id}:${patientId}`),
        1,
      );
    assert.deepEqual(actual, pre[table], `legacy preservation ${table}`);
  }
  assert.equal(post.encounters.find((r: any) => r.id === A).episodeId, caseId);
  assert.equal(post.encounters.find((r: any) => r.id === B).episodeId, null);
  assert.equal(
    post.encounters.find((r: any) => r.id === C).treatmentPathwayId,
    pathwayId,
  );
  assert.ok(
    post.encounters
      .filter((r: any) => [C, D, E].includes(r.id))
      .every((r: any) => r.episodeId === caseId),
  );
  const path = post.treatment_pathways[0];
  const legacy = pre.care_episodes.find((r: any) => r.id === legacyId);
  for (const key of ['startedAt', 'endedAt', 'createdAt'])
    assert.equal(path[key], legacy[key]);
  await reconcile(prisma, manifest);
  assert.deepEqual(
    snapshot([...baselineTables, ...newTables]),
    post,
    'idempotency',
  );
  await prisma.$disconnect();
  drop(); // Actual destruction, not a transaction rollback pretending to restore.
  create();
  docker(
    [
      'exec',
      '-i',
      container,
      'pg_restore',
      '-U',
      'gastrocare_test',
      '-d',
      db,
      '--no-owner',
      '--exit-on-error',
    ],
    readFileSync(join(dir, 'pre.dump')),
  );
  assert.equal(hash(readFileSync(join(dir, 'pre.dump'))), hash(backup));
  assert.deepEqual(
    snapshot(baselineTables),
    pre,
    'PRE restore full-row signatures',
  );
  assert.equal(
    sql('SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM _prisma_migrations t;'),
    preMigrations,
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM information_schema.columns WHERE table_name='encounters' AND column_name='treatmentPathwayId';`,
    ),
    '0',
  );
  migrate();
  prisma = new PrismaClient();
  await reconcile(prisma, manifest);
  assert.deepEqual(
    snapshot([...baselineTables, ...newTables]),
    post,
    'deterministic restore/reapply',
  );
  // >1 candidate STOP with zero mutation, including AuditEvent history.
  await prisma.careEpisode.create({
    data: {
      id: uid(30),
      tenantId,
      patientId,
      episodeType: 'HEMORRHOID_TREATMENT',
      startedAt: new Date(t),
    },
  });
  const beforeStop = snapshot([...baselineTables, ...newTables]);
  await assert.rejects(
    reconcile(prisma, manifest),
    />1 authoritative Case candidate/,
  );
  assert.deepEqual(snapshot([...baselineTables, ...newTables]), beforeStop);
  // Zero candidate cannot silently fabricate a Case. Explicit newCase is required.
  const zeroPatient = await prisma.patient.create({
    data: {
      id: uid(31),
      tenantId,
      fullName: 'SYNTHETIC ZERO',
      normalizedFullName: 'synthetic zero',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'OTHER',
      phone: '0000000000',
      normalizedPhone: '0000000000',
    },
  });
  const zero: ReconciliationManifest = {
    ...manifest,
    id: 'dec016-zero',
    entries: [
      {
        tenantId,
        patientId: zeroPatient.id,
        actorId,
        caseId: uid(32),
        initialEncounterIds: [],
        legacyPathways: [],
      },
    ],
  };
  await assert.rejects(
    reconcile(prisma, zero),
    /zero candidates requires explicit newCase/,
  );
  zero.entries[0].newCase = { startedAt: t, createdAt: t };
  await reconcile(prisma, zero);
  await reconcile(prisma, zero);
  assert.equal(
    await prisma.careEpisode.count({ where: { patientId: zeroPatient.id } }),
    1,
  );
  await prisma.$disconnect();
  const report = {
    status: 'PASS',
    baselineHead,
    baselineChecksums,
    fixture: 'synthetic Run2-shape, NOT actual Owner Run2 data',
    backupSha256: hash(backup),
    preSignature: hash(JSON.stringify(pre)),
    postSignature: hash(JSON.stringify(post)),
    proofs: [
      'Run2 A/B/C/D/E/E1/E2 mapping',
      '0/1/>1 candidates',
      'full legacy row and timestamp preservation',
      'audit and amendment lineage preserved',
      'no fabricated clinical records',
      'idempotency',
      'destroy + PRE restore',
      'deterministic reapply',
    ],
    artifactDirectory: dir,
  };
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  drop();
  console.log(JSON.stringify(report, null, 2));
}
main().catch((err) => {
  console.error('M0 STOP:', err.message, '\nEvidence retained:', dir);
  process.exitCode = 1;
});
