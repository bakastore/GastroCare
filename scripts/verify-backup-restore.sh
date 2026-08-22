#!/usr/bin/env bash
# CORE-03 backup/restore verification — disposable/test PostgreSQL ONLY.
#
# Proves: seed a deterministic synthetic dataset, record baseline evidence,
# take a real pg_dump backup, DESTROY the disposable DB's data, restore from
# the backup, and verify the restored data (rows + relationships) matches
# the baseline. Finishes with a backend regression run as a post-restore
# smoke test.
#
# This script refuses to run against anything that isn't the specific
# disposable container this repo defines in docker-compose.test.yml — see
# the guard block below. It never touches a remote/shared/production
# database, and the backup artifact is written outside the repo (never
# committed).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

# --- Fixed identity of the ONLY database this script is allowed to touch ---
EXPECTED_CONTAINER="gastrocare_foundation_test_db"
EXPECTED_DB="gastrocare_foundation_test"
EXPECTED_DB_USER="gastrocare_test"
EXPECTED_HOST_PORT="55432"
EXPECTED_HOST="localhost"

BACKUP_DIR="${TMPDIR:-/tmp}/gastrocare-backup-verify"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d%H%M%S).sql"
BASELINE_FILE="$BACKUP_DIR/baseline-counts.json"
RESTORED_FILE="$BACKUP_DIR/restored-counts.json"

log() { echo "== $* =="; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# =============================================================================
# SAFETY GUARD — must pass before ANY destructive step runs.
# =============================================================================
log "Safety guard: verifying this is the disposable test database"

DATABASE_URL_FROM_ENV="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"')"
[[ -n "$DATABASE_URL_FROM_ENV" ]] || fail "backend/.env has no DATABASE_URL — refusing to proceed"

case "$DATABASE_URL_FROM_ENV" in
  *"localhost:${EXPECTED_HOST_PORT}/${EXPECTED_DB}"*) ;;
  *) fail "backend/.env DATABASE_URL does not point at localhost:${EXPECTED_HOST_PORT}/${EXPECTED_DB} — refusing to proceed against '$DATABASE_URL_FROM_ENV'" ;;
esac

docker inspect "$EXPECTED_CONTAINER" >/dev/null 2>&1 \
  || fail "container '$EXPECTED_CONTAINER' does not exist — refusing to proceed"

CONTAINER_STATE="$(docker inspect -f '{{.State.Running}}' "$EXPECTED_CONTAINER")"
[[ "$CONTAINER_STATE" == "true" ]] || fail "container '$EXPECTED_CONTAINER' is not running — refusing to proceed"

CONTAINER_DB_NAME="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$EXPECTED_CONTAINER" | grep '^POSTGRES_DB=' | cut -d= -f2)"
[[ "$CONTAINER_DB_NAME" == "$EXPECTED_DB" ]] \
  || fail "container POSTGRES_DB is '$CONTAINER_DB_NAME', expected '$EXPECTED_DB' — refusing to proceed"

HOST_PORT_MAPPING="$(docker port "$EXPECTED_CONTAINER" 5432/tcp 2>/dev/null || true)"
case "$HOST_PORT_MAPPING" in
  *"${EXPECTED_HOST}:${EXPECTED_HOST_PORT}"*|*"0.0.0.0:${EXPECTED_HOST_PORT}"*|*"[::]:${EXPECTED_HOST_PORT}"*) ;;
  *) fail "container port mapping ('$HOST_PORT_MAPPING') does not match expected localhost:${EXPECTED_HOST_PORT} — refusing to proceed" ;;
esac

# Explicit test-mode condition: this compose file's only purpose is
# disposable/test data (see docker-compose.test.yml at repo root).
[[ -f "$ROOT_DIR/docker-compose.test.yml" ]] || fail "docker-compose.test.yml not found — refusing to proceed"
grep -q "$EXPECTED_CONTAINER" "$ROOT_DIR/docker-compose.test.yml" \
  || fail "docker-compose.test.yml does not define '$EXPECTED_CONTAINER' — refusing to proceed"

log "Safety guard PASSED — container=$EXPECTED_CONTAINER db=$EXPECTED_DB host=$EXPECTED_HOST:$EXPECTED_HOST_PORT"

psql_in_container() {
  docker exec -i -e PGPASSWORD="$EXPECTED_DB_USER" "$EXPECTED_CONTAINER" \
    psql -U "$EXPECTED_DB_USER" -d "$EXPECTED_DB" -v ON_ERROR_STOP=1 "$@"
}

record_counts() {
  local out_file="$1"
  psql_in_container -t -A -F',' -c "
    SELECT 'tenants', count(*) FROM tenants
    UNION ALL SELECT 'auth_users', count(*) FROM auth_users
    UNION ALL SELECT 'patients', count(*) FROM patients
    UNION ALL SELECT 'encounters', count(*) FROM encounters
    UNION ALL SELECT 'care_plans', count(*) FROM care_plans
    UNION ALL SELECT 'care_plan_versions', count(*) FROM care_plan_versions
    UNION ALL SELECT 'care_tasks', count(*) FROM care_tasks
    UNION ALL SELECT 'clinical_form_submissions', count(*) FROM clinical_form_submissions
    UNION ALL SELECT 'audit_events', count(*) FROM audit_events
    ORDER BY 1;
  " > "$out_file"
}

record_patient_signature() {
  # A cheap relationship/content spot-check, not just row counts: the
  # signed CarePlan lineage for "Nguyễn Văn Minh" must survive intact.
  psql_in_container -t -A -F',' -c "
    SELECT p.\"fullName\", cp.status, cpv.\"versionNumber\", cpv.reason
    FROM patients p
    JOIN care_plans cp ON cp.\"patientId\" = p.id
    JOIN care_plan_versions cpv ON cpv.\"carePlanId\" = cp.id
    WHERE p.\"fullName\" = 'Nguyễn Văn Minh'
    ORDER BY cpv.\"versionNumber\";
  "
}

record_clinical_form_signature() {
  # Spot-check the new Clinical Forms table: template identity, lifecycle
  # status, and the deterministic computed score must survive intact.
  psql_in_container -t -A -F',' -c "
    SELECT p.\"fullName\", cfs.\"templateKey\", cfs.\"templateVersion\", cfs.status,
           cfs.\"computedScores\"->>'wexner'
    FROM patients p
    JOIN clinical_form_submissions cfs ON cfs.\"patientId\" = p.id
    WHERE p.\"fullName\" = 'Nguyễn Văn Minh'
    ORDER BY cfs.\"createdAt\";
  "
}

# =============================================================================
# 1-2. Apply migrations (idempotent)
# =============================================================================
log "1-2. Applying migrations"
(cd "$BACKEND_DIR" && npx prisma migrate deploy)

# =============================================================================
# 3. Seed the full synthetic walking-skeleton dataset
# =============================================================================
log "3. Seeding deterministic synthetic pilot dataset"
(cd "$BACKEND_DIR" && npm run seed:pilot)

# =============================================================================
# 4. Record objective baseline counts + a relationship spot-check
# =============================================================================
log "4. Recording baseline evidence"
record_counts "$BASELINE_FILE"
echo "--- baseline row counts (table,count) ---"
cat "$BASELINE_FILE"
echo "--- baseline Minh CarePlan lineage (fullName,status,versionNumber,reason) ---"
BASELINE_LINEAGE="$(record_patient_signature)"
echo "$BASELINE_LINEAGE"
echo "--- baseline Minh Clinical Form submission (fullName,templateKey,templateVersion,status,wexnerScore) ---"
BASELINE_CLINICAL_FORM="$(record_clinical_form_signature)"
echo "$BASELINE_CLINICAL_FORM"

BASELINE_AUDIT_COUNT="$(psql_in_container -t -A -c "SELECT count(*) FROM audit_events;")"
[[ "$BASELINE_AUDIT_COUNT" -gt 0 ]] || fail "baseline has zero AuditEvent rows — seed did not run as expected"

# =============================================================================
# 5. Create a real PostgreSQL backup (pg_dump, plain SQL, from inside the
#    container to avoid a host/container pg_dump version mismatch)
# =============================================================================
log "5. Creating backup: $BACKUP_FILE"
docker exec -e PGPASSWORD="$EXPECTED_DB_USER" "$EXPECTED_CONTAINER" \
  pg_dump -U "$EXPECTED_DB_USER" -d "$EXPECTED_DB" --clean --if-exists > "$BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || fail "backup file is empty — aborting before any destructive step"
log "Backup created ($(wc -l < "$BACKUP_FILE") lines) — NOT committed to git (outside repo, in $BACKUP_DIR)"

# =============================================================================
# 6. Destroy ONLY the disposable DB's data (guard already re-verified above)
# =============================================================================
log "6. Destroying disposable DB data (TRUNCATE, same container/db verified above)"
psql_in_container -c "
  TRUNCATE TABLE
    clinical_form_submissions, audit_events, care_tasks, care_plan_versions,
    care_plans, encounters, patients, foundation_probe_records, auth_users,
    tenants
  RESTART IDENTITY CASCADE;
"
POST_TRUNCATE_COUNT="$(psql_in_container -t -A -c "SELECT count(*) FROM tenants;")"
[[ "$POST_TRUNCATE_COUNT" == "0" ]] || fail "truncate did not empty the tenants table as expected"
log "Disposable DB data destroyed (0 tenants remain, confirming destructive step took effect)"

# =============================================================================
# 7. Restore from the backup
# =============================================================================
log "7. Restoring from backup"
psql_in_container < "$BACKUP_FILE" >/dev/null

# =============================================================================
# 8. Verify restored schema/data/relationships match baseline
# =============================================================================
log "8. Verifying restored data against baseline"
record_counts "$RESTORED_FILE"
echo "--- restored row counts (table,count) ---"
cat "$RESTORED_FILE"

if ! diff -u "$BASELINE_FILE" "$RESTORED_FILE"; then
  fail "restored row counts do not match baseline — see diff above"
fi
log "Row counts match baseline exactly"

RESTORED_LINEAGE="$(record_patient_signature)"
[[ "$RESTORED_LINEAGE" == "$BASELINE_LINEAGE" ]] \
  || fail "restored Nguyễn Văn Minh CarePlan lineage does not match baseline"
log "Nguyễn Văn Minh CarePlan lineage (versions 1-2, amendment reason) verified intact after restore"

RESTORED_CLINICAL_FORM="$(record_clinical_form_signature)"
[[ "$RESTORED_CLINICAL_FORM" == "$BASELINE_CLINICAL_FORM" ]] \
  || fail "restored Nguyễn Văn Minh Clinical Form submission does not match baseline"
log "Nguyễn Văn Minh Clinical Form submission (template identity, status, computed score) verified intact after restore"

RESTORED_AUDIT_COUNT="$(psql_in_container -t -A -c "SELECT count(*) FROM audit_events;")"
[[ "$RESTORED_AUDIT_COUNT" == "$BASELINE_AUDIT_COUNT" ]] \
  || fail "restored AuditEvent count ($RESTORED_AUDIT_COUNT) does not match baseline ($BASELINE_AUDIT_COUNT)"
log "AuditEvent count verified intact after restore ($RESTORED_AUDIT_COUNT rows)"

# =============================================================================
# 9. Post-restore application regression (smoke test against restored data)
# =============================================================================
# Run each accepted e2e suite as its own process, in an order where every
# suite that does a FULL table wipe in its own beforeAll (core01, core03)
# runs before gate2-foundation, whose beforeAll only resets Foundation
# tables. This makes the smoke test robust to the restored pilot dataset
# still being present (which it deliberately is, at this point) without
# touching any accepted test file.
log "9. Running backend regression against the restored database as a smoke test"
(cd "$BACKEND_DIR" && npx jest --config ./test/jest-e2e.json --runInBand test/core01-clinical-walking-skeleton.e2e-spec.ts)
(cd "$BACKEND_DIR" && npx jest --config ./test/jest-e2e.json --runInBand test/core03-hardening.e2e-spec.ts)
(cd "$BACKEND_DIR" && npx jest --config ./test/jest-e2e.json --runInBand test/clinical-forms.e2e-spec.ts)
(cd "$BACKEND_DIR" && npx jest --config ./test/jest-e2e.json --runInBand test/gate2-foundation.e2e-spec.ts)

# The backend e2e suite resets/creates its own tenants inside its own
# beforeAll/afterAll hooks (disposable DB only), so re-seed the pilot
# dataset afterward to leave the DB in the same known-good state described
# by OPERATIONS.md for the Owner's next dry run.
log "Re-seeding pilot dataset to leave the DB in the documented dry-run state"
(cd "$BACKEND_DIR" && npm run seed:pilot)

echo
log "BACKUP/RESTORE VERIFICATION: PASS"
echo "Backup artifact: $BACKUP_FILE (not tracked by git, outside the repository)"
