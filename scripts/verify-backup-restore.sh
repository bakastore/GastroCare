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
    UNION ALL SELECT 'care_episodes', count(*) FROM care_episodes
    UNION ALL SELECT 'treatment_pathways', count(*) FROM treatment_pathways
    UNION ALL SELECT 'investigations', count(*) FROM investigations
    UNION ALL SELECT 'investigation_orders', count(*) FROM investigation_orders
    UNION ALL SELECT 'investigation_results', count(*) FROM investigation_results
    UNION ALL SELECT 'care_plans', count(*) FROM care_plans
    UNION ALL SELECT 'care_plan_versions', count(*) FROM care_plan_versions
    UNION ALL SELECT 'care_tasks', count(*) FROM care_tasks
    UNION ALL SELECT 'clinical_form_submissions', count(*) FROM clinical_form_submissions
    UNION ALL SELECT 'audit_events', count(*) FROM audit_events
    UNION ALL SELECT 'facilities', count(*) FROM facilities
    UNION ALL SELECT 'rooms', count(*) FROM rooms
    UNION ALL SELECT 'clinician_assignment_history', count(*) FROM clinician_assignment_history
    ORDER BY 1;
  " > "$out_file"
}

# Hash every field of every public table, including audit history and migration
# metadata. Canonical row order avoids relying on physical restore order.
# Raw synthetic rows stay in this pipe and are never logged or committed.
record_full_signature() {
  psql_in_container -t -A <<'SQL' | sha256sum | cut -d' ' -f1
SELECT format('SELECT %L, COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, ''[]'') FROM public.%I t;', tablename, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL
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
  # Spot-check the Clinical Forms amendment lineage (CORE-04 T2): every
  # revision in Minh's chain, in order, with its provenance and computed
  # score, must survive intact — including that the original revision-1 row
  # is untouched by the later amendment.
  psql_in_container -t -A -F',' -c "
    SELECT p.\"fullName\", cfs.\"templateKey\", cfs.\"templateVersion\", cfs.status,
           cfs.\"revisionNumber\", cfs.\"logicalGroupId\" = cfs.id AS is_chain_root,
           cfs.\"previousSubmissionId\", cfs.\"amendmentReason\",
           cfs.\"completedByUserId\" IS NOT NULL AS has_completer,
           cfs.\"computedScores\"->>'wexner'
    FROM patients p
    JOIN clinical_form_submissions cfs ON cfs.\"patientId\" = p.id
    WHERE p.\"fullName\" = 'Nguyễn Văn Minh'
    ORDER BY cfs.\"logicalGroupId\", cfs.\"revisionNumber\";
  "
}

record_care_episode_signature() {
  # CORE-04 T1 — Minh's CareEpisode and the Encounter linked to it must
  # survive intact.
  psql_in_container -t -A -F',' -c "
    SELECT p.\"fullName\", ce.\"episodeType\", ce.status,
           (SELECT count(*) FROM encounters e WHERE e.\"episodeId\" = ce.id) AS linked_encounters
    FROM patients p
    JOIN care_episodes ce ON ce.\"patientId\" = p.id
    WHERE p.\"fullName\" = 'Nguyễn Văn Minh'
    ORDER BY ce.\"startedAt\";
  "
}

record_longo_pathway_signature() {
  # CORE-04 T4-T11 — Lê Thị Longo's full Longo pathway: all six form
  # families completed (with one amendment revision on PREOP), and the
  # deterministic T10 follow-up scheduling state (idempotent generation +
  # matched completion, anchored on Surgery Encounter.occurredAt — never
  # createdAt) must survive intact.
  psql_in_container -t -A -F',' -c "
    SELECT cfs.\"templateKey\", cfs.\"revisionNumber\", cfs.status,
           cfs.\"computedScores\"->>'longTermTotal'
    FROM patients p
    JOIN clinical_form_submissions cfs ON cfs.\"patientId\" = p.id
    WHERE p.\"fullName\" = 'Lê Thị Longo'
    ORDER BY cfs.\"templateKey\", cfs.\"revisionNumber\";
  "
}

record_hemorrhoid_slice1_signature() {
  # Hemorrhoid Vertical Slice 1 (DEC-010) — "Phạm Thị Trĩ": Facility/Room
  # field-level content, Encounter.responsibleClinicianId presence, the
  # per-examination vital copy-forward snapshot weight (its own stored
  # value — 54 for the first exam, 55 for the second, edited from the
  # copied 54 — see test/pilot-seed.ts), the HEMORRHOID_EXAMINATION
  # amendment lineage/status, and (DEC-010 Finding 2 correction) the
  # internal/external/mixed hemorrhoid size split — internalHemorrhoidSize
  # is set on the first exam only, proving that specific generalized field
  # (not a legacy shared mainHemorrhoidSize) survives the round trip with
  # its exact value. The dedicated backend e2e suite
  # (test/hemorrhoid-slice1.e2e-spec.ts) separately proves a later
  # amendment to a SOURCE record never mutates an already-copied snapshot;
  # this signature proves that stored snapshot content itself survives
  # backup/restore unchanged.
  psql_in_container -t -A -F',' -c "
    SELECT p.\"fullName\", f.name, r.name,
           (e.\"responsibleClinicianId\" IS NOT NULL) AS has_responsible_clinician,
           cfs.\"templateKey\", cfs.status, cfs.\"revisionNumber\",
           cfs.responses->>'weight' AS snapshot_weight,
           cfs.responses->>'internalHemorrhoidSize' AS snapshot_internal_size,
           (cfs.responses ? 'mainHemorrhoidSize') AS has_legacy_main_size
    FROM patients p
    JOIN encounters e ON e.\"patientId\" = p.id
    JOIN rooms r ON r.id = e.\"roomId\"
    JOIN facilities f ON f.id = r.\"facilityId\"
    JOIN clinical_form_submissions cfs ON cfs.\"encounterId\" = e.id
    WHERE p.\"fullName\" = 'Phạm Thị Trĩ' AND cfs.\"templateKey\" = 'HEMORRHOID_EXAMINATION'
    ORDER BY e.\"occurredAt\", cfs.\"revisionNumber\";
  "
}

record_clinician_handover_signature() {
  # Full clinician-assignment provenance for Phạm Thị Trĩ's first Encounter
  # (initial assignment row with previousClinicianId NULL, plus the
  # handover row with previousClinicianId set) must survive intact —
  # including that the ENCOUNTER_CREATED AuditEvent keeps its original
  # actor even after the later handover.
  psql_in_container -t -A -F',' -c "
    SELECT cah.\"previousClinicianId\" IS NULL AS is_initial_assignment,
           cah.reason
    FROM clinician_assignment_history cah
    JOIN encounters e ON e.id = cah.\"encounterId\"
    JOIN patients p ON p.id = e.\"patientId\"
    WHERE p.\"fullName\" = 'Phạm Thị Trĩ'
    ORDER BY cah.\"assignedAt\";
  "
}

record_follow_up_scheduling_signature() {
  # CORE-04 T10 — the 4 generated follow-up CareTasks for Lê Thị Longo's
  # surgery: timepointCode, stored status, and completedByEncounterId
  # presence must survive intact. episodeId is intentionally never a
  # care_tasks column (it is inferred via sourceEncounterId), so it cannot
  # appear here by construction.
  psql_in_container -t -A -F',' -c "
    SELECT ct.\"timepointCode\", ct.status,
           ct.\"completedByEncounterId\" IS NOT NULL AS matched,
           ct.\"scheduleReviewRequired\", ct.\"carePlanId\" IS NULL AS no_care_plan
    FROM care_tasks ct
    JOIN encounters e ON e.id = ct.\"sourceEncounterId\"
    JOIN patients p ON p.id = e.\"patientId\"
    WHERE p.\"fullName\" = 'Lê Thị Longo'
    ORDER BY ct.\"timepointCode\";
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
BASELINE_FULL_SIGNATURE="$(record_full_signature)"
log "All-table baseline SHA256: $BASELINE_FULL_SIGNATURE"
echo "--- baseline row counts (table,count) ---"
cat "$BASELINE_FILE"
echo "--- baseline Minh CarePlan lineage (fullName,status,versionNumber,reason) ---"
BASELINE_LINEAGE="$(record_patient_signature)"
echo "$BASELINE_LINEAGE"
echo "--- baseline Minh Clinical Form lineage (fullName,templateKey,templateVersion,status,revisionNumber,isChainRoot,previousSubmissionId,amendmentReason,hasCompleter,wexnerScore) ---"
BASELINE_CLINICAL_FORM="$(record_clinical_form_signature)"
echo "$BASELINE_CLINICAL_FORM"
echo "--- baseline Minh CareEpisode (fullName,episodeType,status,linkedEncounters) ---"
BASELINE_CARE_EPISODE="$(record_care_episode_signature)"
echo "$BASELINE_CARE_EPISODE"
echo "--- baseline Lê Thị Longo six-form pathway (templateKey,revisionNumber,status,longTermWexnerTotal) ---"
BASELINE_LONGO_PATHWAY="$(record_longo_pathway_signature)"
echo "$BASELINE_LONGO_PATHWAY"
echo "--- baseline Lê Thị Longo follow-up scheduling (timepointCode,status,matched,scheduleReviewRequired,noCarePlan) ---"
BASELINE_FOLLOW_UP="$(record_follow_up_scheduling_signature)"
echo "$BASELINE_FOLLOW_UP"
echo "--- baseline Phạm Thị Trĩ Hemorrhoid Vertical Slice 1 (fullName,facility,room,hasResponsibleClinician,templateKey,status,revisionNumber,snapshotWeight,snapshotInternalSize,hasLegacyMainSize) ---"
BASELINE_HEMORRHOID_SLICE1="$(record_hemorrhoid_slice1_signature)"
echo "$BASELINE_HEMORRHOID_SLICE1"
echo "--- baseline Phạm Thị Trĩ clinician handover provenance (isInitialAssignment,reason) ---"
BASELINE_CLINICIAN_HANDOVER="$(record_clinician_handover_signature)"
echo "$BASELINE_CLINICIAN_HANDOVER"

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
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
cat "$BACKUP_FILE.sha256"
log "Backup created ($(wc -l < "$BACKUP_FILE") lines) — NOT committed to git (outside repo, in $BACKUP_DIR)"

# =============================================================================
# 6. Destroy ONLY the disposable DB's data (guard already re-verified above)
# =============================================================================
log "6. Destroying disposable DB data (TRUNCATE, same container/db verified above)"
psql_in_container -c "
  TRUNCATE TABLE
    clinical_form_submissions, audit_events, care_tasks, care_plan_versions,
    care_plans, clinician_assignment_history, encounters, care_episodes,
    rooms, facilities, patients, foundation_probe_records,
    auth_users, tenants
  RESTART IDENTITY CASCADE;
"
POST_TRUNCATE_COUNT="$(psql_in_container -t -A -c "SELECT count(*) FROM tenants;")"
[[ "$POST_TRUNCATE_COUNT" == "0" ]] || fail "truncate did not empty the tenants table as expected"
log "Disposable DB data destroyed (0 tenants remain, confirming destructive step took effect)"

# =============================================================================
# 7. Restore from the backup
# =============================================================================
log "7. Restoring from backup"
sha256sum --check "$BACKUP_FILE.sha256"
psql_in_container < "$BACKUP_FILE" >/dev/null

# =============================================================================
# 8. Verify restored schema/data/relationships match baseline
# =============================================================================
log "8. Verifying restored data against baseline"
record_counts "$RESTORED_FILE"
RESTORED_FULL_SIGNATURE="$(record_full_signature)"
[[ "$RESTORED_FULL_SIGNATURE" == "$BASELINE_FULL_SIGNATURE" ]] || fail "all-table canonical row signature differs after restore"
log "All-table restored SHA256 matches: $RESTORED_FULL_SIGNATURE"
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
  || fail "restored Nguyễn Văn Minh Clinical Form amendment lineage does not match baseline"
log "Nguyễn Văn Minh Clinical Form amendment lineage (revisions 1-2, original row untouched, provenance, computed score) verified intact after restore"

RESTORED_CARE_EPISODE="$(record_care_episode_signature)"
[[ "$RESTORED_CARE_EPISODE" == "$BASELINE_CARE_EPISODE" ]] \
  || fail "restored Nguyễn Văn Minh CareEpisode does not match baseline"
log "Nguyễn Văn Minh CareEpisode (type, status, linked Encounter) verified intact after restore"

RESTORED_LONGO_PATHWAY="$(record_longo_pathway_signature)"
[[ "$RESTORED_LONGO_PATHWAY" == "$BASELINE_LONGO_PATHWAY" ]] \
  || fail "restored Lê Thị Longo six-form pathway does not match baseline"
log "Lê Thị Longo six-form Longo pathway (all templates, amendment revision, deterministic Wexner total) verified intact after restore"

RESTORED_FOLLOW_UP="$(record_follow_up_scheduling_signature)"
[[ "$RESTORED_FOLLOW_UP" == "$BASELINE_FOLLOW_UP" ]] \
  || fail "restored Lê Thị Longo follow-up scheduling state does not match baseline"
log "Lê Thị Longo T10 follow-up scheduling (4 timepoints, matched completion, no carePlanId) verified intact after restore"

RESTORED_HEMORRHOID_SLICE1="$(record_hemorrhoid_slice1_signature)"
[[ "$RESTORED_HEMORRHOID_SLICE1" == "$BASELINE_HEMORRHOID_SLICE1" ]] \
  || fail "restored Phạm Thị Trĩ Hemorrhoid Vertical Slice 1 data (Facility/Room/responsibleClinicianId/HEMORRHOID_EXAMINATION lineage/vital snapshot) does not match baseline"
log "Phạm Thị Trĩ Hemorrhoid Vertical Slice 1 (Facility/Room, responsibleClinicianId, HEMORRHOID_EXAMINATION amendment lineage, vital copy-forward snapshot) verified intact after restore"

RESTORED_CLINICIAN_HANDOVER="$(record_clinician_handover_signature)"
[[ "$RESTORED_CLINICIAN_HANDOVER" == "$BASELINE_CLINICIAN_HANDOVER" ]] \
  || fail "restored Phạm Thị Trĩ clinician handover provenance does not match baseline"
log "Phạm Thị Trĩ clinician handover provenance (initial assignment + handover history) verified intact after restore"

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
(cd "$BACKEND_DIR" && npm run test:e2e)

# The backend e2e suite resets/creates its own tenants inside its own
# beforeAll/afterAll hooks (disposable DB only), so re-seed the pilot
# dataset afterward to leave the DB in the same known-good state described
# by OPERATIONS.md for the Owner's next dry run.
log "Re-seeding pilot dataset to leave the DB in the documented dry-run state"
(cd "$BACKEND_DIR" && npm run seed:pilot)

echo
log "BACKUP/RESTORE VERIFICATION: PASS"
echo "Backup artifact: $BACKUP_FILE (not tracked by git, outside the repository)"
