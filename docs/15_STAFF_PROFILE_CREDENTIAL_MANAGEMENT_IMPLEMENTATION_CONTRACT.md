# 15 — Staff Profile & Credential Management — Implementation Contract

**Status:** OWNER LOCKED  
**Version:** 0.1  
**Authority:** DEC-019 — OWNER LOCKED (2026-08-30)  
**Baseline:** DEC-018 CLOSED — OWNER ACCEPTED — remote checkpoint `7d33e02c36f5e862c50717c340deea86ad046e47`  
**Data:** SYNTHETIC ONLY — NO real-patient runtime, NO production deployment.  
**Implementation authorization:** T0→T6 authorized; T7 = Fresh Codex independent focused read-only audit; T8 = Owner Synthetic Acceptance. NO commit/push/merge/tag without separate Owner authorization.  
**Review gate:** CLOSED — PASS. Required T4.1 ordering correction and migration-workflow wording correction were applied before Owner Lock.

---

## 0. Baseline

Current verified foundation:

- `AuthUser` = account/auth/operational role/Clinic Admin capability.
- roles remain `DOCTOR`, `NURSE`, `RECEPTIONIST`.
- `ClinicAdminGuard` already exists and is the write authority for clinic-admin user management.
- `Facility` / `Room` are tenant-scoped location entities.
- `/clinic-admin/users` is the canonical user-management surface.
- `/auth/me` is current DB-backed authority.
- AuditEvent is append-only.
- real-patient runtime and production remain NOT AUTHORIZED.
- no upload/object-storage feature is opened by this package.
- `/clinicians` remains clinical operational lookup and is NOT enriched by DEC-019.

No DEC-019 code/schema exists in baseline.

Execution sequence after Owner Lock:

```text
T0 → T1 → T2 → T3 → T4 → T5 → T6
→ T7 Fresh Codex focused read-only audit
→ T8 Owner Synthetic Acceptance
```

---

## 1. Contract authority

After Owner Lock, the following are mandatory:

1. `AuthUser` remains the authentication/account entity.
2. `StaffProfile` is a separate optional 1:1 professional profile.
3. No professional profile field becomes authentication or clinical authorization authority.
4. Every new table has direct `tenantId`.
5. No request DTO accepts client-controlled `tenantId`.
6. Tenant isolation is backend-enforced.
7. Credential expiry is derived, not persisted as `EXPIRED`.
8. Employment overlap is allowed.
9. StaffFacilityAssignment allows multi-facility active work but exactly one primary while any active assignment exists.
10. Changing primary never ends the old facility assignment.
11. Facility assignment history is never hard-deleted.
12. Credential and EmploymentHistory may be hard-deleted with atomic audit.
13. `avatar`/binary file storage is deferred.
14. `/clinicians` enrichment is deferred.
15. A-001 product-specialty hypothesis remains independent from staff specialty.
16. Synthetic data only.

---

## 2. Hard out of scope

```text
System Admin
generic permission engine
facility-based clinical ACL
Staff Directory
clinician selector enrichment
roster / scheduling
payroll
attendance / leave
employment contracts
CCCD / passport
home address / bank account
avatar upload
credential file/PDF scan
object storage
CORE-05
AI
production
real-patient runtime
```

No change to clinical semantics DEC-010→018.

---

# T0 — Preflight + governance activation

Before any implementation:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git diff --check
git log -5 --oneline
```

Read, in AGENTS.md Startup Protocol order:

```text
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
docs/04_CORE_DOMAIN_MODEL.md
docs/05_ARCHITECTURE_BASELINE.md
docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md
docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md
```

STOP if branch/HEAD differs materially from Owner-approved DEC-019 baseline or there are unexplained dirty schema/application/test files.

Governance persistence at T0 (Owner Lock already granted):

- append DEC-019 OWNER LOCKED block to `DECISION_LOG.md`;
- update PROJECT_STATE / ROADMAP current work package;
- add this Contract as `docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`;
- clean stale DEC-018 sentence saying worktree is uncommitted, without rewriting historical acceptance evidence;
- real-patient runtime remains NOT AUTHORIZED.

No commit/push without Owner authorization.

---

# T1 — Schema + additive migration

## T1.1 Enums

```prisma
enum StaffSpecialty {
  GASTROENTEROLOGY
  COLORECTAL_SURGERY
  GENERAL_SURGERY
  OTHER
}

enum StaffCredentialType {
  LICENSE
  CERTIFICATE
  TRAINING
}

enum StaffCredentialStatus {
  ACTIVE
  REVOKED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  COLLABORATOR
}
```

## T1.2 StaffProfile

Target shape:

```prisma
model StaffProfile {
  id                   String   @id @default(uuid())
  tenantId             String
  tenant               Tenant   @relation(fields: [tenantId], references: [id])

  authUserId           String   @unique
  authUser             AuthUser @relation(fields: [authUserId], references: [id])

  fullName             String
  professionalTitle    String?
  workPhone            String?
  primarySpecialty     StaffSpecialty?
  secondarySpecialties StaffSpecialty[]
  specialtyOtherLabel  String?
  biography            String?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  credentials          StaffCredential[]
  employmentHistory    EmploymentHistory[]
  facilityAssignments  StaffFacilityAssignment[]

  @@index([tenantId])
  @@map("staff_profiles")
}
```

Add inverse:

```prisma
AuthUser.staffProfile StaffProfile?
```

and Tenant inverse relations.

No backfill. Existing AuthUsers remain without StaffProfile until explicitly created.

## T1.3 StaffCredential

```prisma
model StaffCredential {
  id                  String                @id @default(uuid())
  tenantId            String
  tenant              Tenant                @relation(fields: [tenantId], references: [id])
  staffProfileId      String
  staffProfile        StaffProfile          @relation(fields: [staffProfileId], references: [id])

  credentialType      StaffCredentialType
  name                String
  credentialNumber    String?
  issuingOrganization String?
  issueDate           DateTime?             @db.Date
  expiryDate          DateTime?             @db.Date
  status              StaffCredentialStatus @default(ACTIVE)
  note                String?

  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  @@index([tenantId])
  @@index([tenantId, staffProfileId])
  @@map("staff_credentials")
}
```

No uniqueness assumption on `credentialNumber`.

## T1.4 EmploymentHistory

```prisma
model EmploymentHistory {
  id               String         @id @default(uuid())
  tenantId         String
  tenant           Tenant         @relation(fields: [tenantId], references: [id])
  staffProfileId   String
  staffProfile     StaffProfile   @relation(fields: [staffProfileId], references: [id])

  organizationName String
  department       String?
  positionTitle    String?
  startDate        DateTime       @db.Date
  endDate          DateTime?      @db.Date
  employmentType   EmploymentType?
  note             String?

  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([tenantId])
  @@index([tenantId, staffProfileId])
  @@map("employment_history")
}
```

## T1.5 StaffFacilityAssignment

```prisma
model StaffFacilityAssignment {
  id             String       @id @default(uuid())
  tenantId       String
  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  staffProfileId String
  staffProfile   StaffProfile @relation(fields: [staffProfileId], references: [id])
  facilityId     String
  facility       Facility     @relation(fields: [facilityId], references: [id])

  isPrimary      Boolean      @default(false)
  startDate      DateTime     @db.Date
  endDate        DateTime?    @db.Date

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([tenantId])
  @@index([tenantId, staffProfileId])
  @@index([tenantId, facilityId])
  @@map("staff_facility_assignments")
}
```

Add Facility inverse relation.

## T1.6 Manual partial-index migration — mandatory

Repository baseline uses Prisma 6.x. Do NOT try to express these partial unique indexes in `schema.prisma`.

Create migration without applying:

```bash
npx prisma migrate dev --create-only --name dec019_staff_profile_credential_management
```

Edit generated `migration.sql` manually and append exactly the PostgreSQL constraints below using actual camelCase column names:

```sql
CREATE UNIQUE INDEX "staff_facility_assignments_one_active_primary"
ON "staff_facility_assignments" ("staffProfileId")
WHERE "isPrimary" = true AND "endDate" IS NULL;

CREATE UNIQUE INDEX "staff_facility_assignments_one_active_per_facility"
ON "staff_facility_assignments" ("staffProfileId", "facilityId")
WHERE "endDate" IS NULL;
```

Do not use snake_case column identifiers.

After edit, apply only to isolated local/test PostgreSQL. This is the first manually-edited Prisma migration in this repository; do not search for or rely on a prior raw-SQL migration template. Verify the edited file preserves Prisma's generated SQL style/ordering around the appended indexes before applying it.

Required verification:

- `prisma validate`;
- PRE-DEC019 → DEC019 migration probe;
- query `pg_indexes` and prove both predicates exist;
- prove duplicate active primary rejected;
- prove duplicate active same-profile/same-facility rejected;
- prove historical ended row permits later rejoin;
- backup/restore includes all 4 new tables + partial indexes.

Migration is additive; no backfill and no destructive change.

---

# T2 — Staff Profile backend + self view

Create focused service/module; exact file organization may follow existing NestJS conventions.

Clinic Admin endpoints:

```text
GET /clinic-admin/users/:id/profile
PUT /clinic-admin/users/:id/profile
```

Self endpoint:

```text
GET /auth/me/profile
```

Rules:

- Admin target lookup: `id + actor.tenantId`; foreign id → 404.
- Self target: current authenticated `userId + tenantId`.
- Profile is optional; GET may return null profile.
- PUT creates on first call, updates thereafter.
- Creating profile requires `fullName`; never infer from email/displayName.
- `AuthUser.displayName` is not auto-updated.
- account role/status/admin capability never auto-change from profile mutation.
- disabled account retains profile; no cascade/delete behavior added.

Suggested validation bounds:

```text
fullName             required, trimmed, max 200
professionalTitle    optional, trimmed, max 100
workPhone            optional, trimmed, max 50
specialtyOtherLabel  optional, trimmed, max 100
biography            optional, max 2000
```

Specialty invariants:

- secondary list has no duplicates;
- primary cannot also appear in secondary;
- if `OTHER` appears anywhere, `specialtyOtherLabel` required;
- without `OTHER`, other-label must be null/empty.

`GET /auth/me/profile` is read-only; it may return account summary + profile aggregate but never exposes password/session secrets.

---

# T3 — Credential + Employment backend

## T3.1 Credential

Endpoints:

```text
GET    /clinic-admin/users/:id/credentials
POST   /clinic-admin/users/:id/credentials
PATCH  /clinic-admin/users/:id/credentials/:credentialId
DELETE /clinic-admin/users/:id/credentials/:credentialId
```

Every child lookup:

```text
tenantId + staffProfileId + credentialId
```

Dates are `YYYY-MM-DD` input and persisted as `@db.Date`.

Validation:

- `expiryDate >= issueDate` when both supplied;
- no uniqueness on credential number;
- status only ACTIVE/REVOKED.

Effective status is computed at read time:

```text
REVOKED > EXPIRED > ACTIVE
```

`EXPIRED` is never persisted.

DELETE is true hard delete but must be transactionally coupled with AuditEvent.

## T3.2 Employment

Endpoints:

```text
GET    /clinic-admin/users/:id/employment-history
POST   /clinic-admin/users/:id/employment-history
PATCH  /clinic-admin/users/:id/employment-history/:recordId
DELETE /clinic-admin/users/:id/employment-history/:recordId
```

Every child lookup:

```text
tenantId + staffProfileId + recordId
```

Validation:

```text
startDate required
endDate optional
endDate >= startDate
```

Overlapping records are explicitly allowed.

DELETE = hard delete + atomic audit.

---

# T4 — Facility Assignment lifecycle + DB concurrency invariant

Endpoints:

```text
GET   /clinic-admin/users/:id/facility-assignments
POST  /clinic-admin/users/:id/facility-assignments
PATCH /clinic-admin/users/:id/facility-assignments/:assignmentId
```

No DELETE.

Create requires:

```text
StaffProfile.tenantId == Facility.tenantId == actor.tenantId
```

Wrong-tenant profile/facility/assignment → 404 non-leak.

Active assignment:

```text
endDate == null
```

## T4.1 Primary invariant

If active assignment count > 0, exactly one active assignment must be primary.

Create behavior:

- first active assignment must become primary;
- later assignment defaults secondary unless request explicitly asks to make it primary;
- when new assignment becomes primary, previous active primary is demoted to `false` in the same transaction;
- **change-primary MUST use ordered writes because the partial unique index is non-deferrable:** (1) demote the current active primary first by setting `isPrimary = false` without changing its `endDate`; (2) only after that statement succeeds, promote the target assignment by setting `isPrimary = true`;
- **the reverse order is forbidden** because promoting the target while the old active primary still exists would spuriously violate `staff_facility_assignments_one_active_primary`;
- changing primary does NOT set old assignment endDate.

## T4.2 End behavior

Ending assignment:

- set `endDate`; no hard delete;
- no reopen by clearing endDate;
- rejoin = new assignment row;
- if ending current primary and no other active assignment remains: allowed, resulting primary count = 0;
- if ending current primary and other active assignments remain: request MUST provide valid active `replacementPrimaryAssignmentId` in same profile/tenant; in the same transaction, ordered writes are mandatory: (1) set the old primary `endDate` first so it leaves the non-deferrable active-primary partial unique index; (2) only then set the replacement `isPrimary = true`; reversing this order is forbidden because it can spuriously violate `staff_facility_assignments_one_active_primary`;
- never auto-select replacement.

Historical ended assignment may preserve `isPrimary=true`; partial index ignores ended rows.

## T4.3 Concurrency

No SERIALIZABLE and no automatic retry.

DB partial unique indexes are the final concurrency guard.

Map partial-index unique violation / Prisma `P2002` to `409 Conflict` with reload-and-retry guidance.

Required real-PostgreSQL tests:

1. concurrent attempt to make two different active assignments primary → cannot finish with two active primary;
2. final state with active assignments always has exactly one primary;
3. concurrent duplicate same-facility creation → max one active row for profile+facility;
4. audit exists only for committed mutation;
5. no cross-tenant facility/profile pairing.

---

# T5 — Audit + authorization + tenant isolation

Reuse existing `ClinicAdminGuard`; no generic permission engine.

Clinic Admin write/read authority applies to all `/clinic-admin/users/:id/...` DEC-019 endpoints.

Self user only:

```text
GET /auth/me/profile
```

No self-edit endpoint.

Required audit actions:

```text
STAFF_PROFILE_CREATED
STAFF_PROFILE_UPDATED
CREDENTIAL_ADDED
CREDENTIAL_UPDATED
CREDENTIAL_REMOVED
EMPLOYMENT_RECORD_ADDED
EMPLOYMENT_RECORD_UPDATED
EMPLOYMENT_RECORD_REMOVED
FACILITY_ASSIGNMENT_ADDED
FACILITY_ASSIGNMENT_PRIMARY_CHANGED
FACILITY_ASSIGNMENT_ENDED
```

Every event carries `metadata.targetUserId` so deleted child entities remain queryable by user history.

Add:

```text
GET /clinic-admin/users/:id/staff-audit
```

Existing DEC-018:

```text
GET /clinic-admin/users/:id/audit
```

must remain behaviorally unchanged.

Audit metadata minimization:

- profile update: `changedFields` only;
- credential add/update: ids/type/name as needed; no credentialNumber/note;
- credential delete: type/name descriptor;
- employment delete: organizationName + optional positionTitle only;
- facility: facilityId/assignment ids;
- no biography/workPhone/note payload duplication.

Mutation + audit atomic.

Tenant isolation mandatory cases for all 4 entities:

- Tenant A admin cannot list/read/create/update/delete Tenant B staff data.
- Child id cannot escape parent tenant/profile.
- Spoofed tenantId in payload is rejected/ignored by DTO because tenantId is not accepted.
- Self endpoint can only resolve current user.
- wrong-tenant id preserves 404 non-leak.

---

# T6 — Frontend

## T6.1 UsersPage

Keep DEC-018 list compact.

Add:

```text
Xem
```

route:

```text
/clinic-admin/users/:id
```

Do not put full professional profile into the existing Edit User modal.

## T6.2 Clinic Admin User Detail

Page tabs:

```text
Tổng quan
Chuyên môn
Chứng chỉ
Công tác
Nhật ký
```

Expected:

- account summary visible;
- basic/professional profile edit;
- credential list/add/edit/delete;
- employment list/add/edit/delete;
- facility assignment list/add/make-primary/end;
- clear primary badge and active/ended status;
- audit merges DEC-018 user-management audit + DEC-019 staff-audit ordered by seq;
- mutation uses existing NotificationProvider PROCESSING/SUCCESS/ERROR pattern;
- destructive delete requires confirmation;
- facility end/primary controls reflect lifecycle rules and surface 409 without hiding state.

## T6.3 Self profile

Route:

```text
/profile
```

All ACTIVE authenticated roles can view own profile read-only.

Use the existing AppShell identity area as the minimal entry point; do not add a new full sidebar group.

No self-edit.

## T6.4 Explicit non-integration

Do NOT change:

```text
CliniciansService selection semantics
GET /clinicians response
Encounter clinician assignment/handover
Investigation assignee selection
clinical permissions
```

---

# T7 — Full validation + one independent focused audit

Before audit:

Backend:

- schema/migration validation;
- targeted DEC-019 E2E;
- tenant isolation tests;
- date validation tests;
- hard-delete + audit atomicity tests;
- facility primary/same-facility real-PostgreSQL concurrency tests;
- full backend unit/E2E/build.

Frontend:

- profile detail component tests;
- self-view test;
- notification/error/busy-state tests;
- full frontend test/build/lint;
- focused browser E2E with synthetic data.

Repository/governance:

- backup/restore;
- privacy/secret scan;
- `git diff --check`;
- no real patient data;
- no unexpected clinical-core changes.

Then exactly one Fresh Codex independent focused READ-ONLY audit, separate from implementation session, limited to:

```text
R1 migration + manual partial indexes
R2 tenant isolation / ancestry
R3 facility lifecycle + concurrency
R4 audit atomicity/minimization
R5 regression boundary (no clinical authorization semantics changed)
```

If PASS → T7 closed.

If finding → remediate affected delta; Owner decides whether another focused re-check is necessary based on severity/scope. Do not create automatic audit loops.

---

# T8 — Owner Synthetic Acceptance

Claude/AI cannot self-close.

Use synthetic users/facilities only.

Minimum Owner walkthrough:

1. Clinic Admin opens existing user → `Xem`.
2. Create basic StaffProfile.
3. Edit title/specialty/work phone/biography.
4. Add credential; verify effective ACTIVE.
5. Add an already expired synthetic credential; UI shows EXPIRED without storing EXPIRED.
6. Mark credential REVOKED; UI shows REVOKED precedence.
7. Add overlapping EmploymentHistory records; both accepted.
8. Add Facility A → becomes/selected primary.
9. Add Facility B secondary.
10. Switch primary A→B; A remains ACTIVE assignment.
11. End B while A active; explicitly choose A replacement; B ends, A primary.
12. Attempt wrong/duplicate active facility behavior as applicable; error feedback clear.
13. View combined audit; no credential number/note/biography/workPhone leakage.
14. Log in as staff user; `/profile` self-view works read-only.
15. Ordinary non-admin cannot access another staff full profile.
16. Existing clinical flows remain usable; no `/clinicians` semantic change.

Owner explicit declaration required:

```text
T8 OWNER SYNTHETIC ACCEPTANCE = PASS
DEC-019 = OWNER ACCEPTED
```

Only after governance closure + Owner-authorized Git checkpoint may package be recorded CLOSED/REMOTE CHECKPOINTED.

---

## Report contract

Every Claude Code implementation report:

```text
STATUS
BASELINE
FILES CHANGED
TESTS
FINDINGS
BLOCKERS
GIT STATUS
NEXT GATE
```

No commit/push/merge/tag unless Owner explicitly authorizes.

---

## OWNER CLOSURE OVERRIDE — 2026-08-31

**Status:** OWNER CLOSED — 2026-08-31 (Owner-directed governance closure).

All original text above (Status header, T0–T8, gate/acceptance requirements) is
preserved unchanged as the historical locked Contract requirements. This section
only overrides current execution status; it does not rewrite or weaken the
locked requirements.

Owner override:

1. `DEC-019` = **OWNER CLOSED**. The `T0 → T1 → ... → T6 → T7 → T8` execution
   sequence is no longer an active pipeline.
2. `T7` (Fresh Codex independent focused read-only audit — R1..R5) = **WAIVED BY
   OWNER — NOT EXECUTED**. The R1–R5 audit scope text remains as a historical
   Contract requirement only.
3. `T8` (Owner Synthetic Acceptance — the 16-step walkthrough) = **WAIVED BY
   OWNER — NOT EXECUTED**. The walkthrough steps remain historical requirement
   text only.
4. No PASS / acceptance is claimed for DEC-019: no T7 PASS, no T8 PASS, no Owner
   Synthetic Acceptance, no additional Technical Acceptance, no Product
   Acceptance.
5. Existing T0–T6 implementation is preserved in the working tree; no rollback.
6. No further DEC-019 work is authorized.
7. `SYNTHETIC ONLY`; real-patient runtime and production remain NOT AUTHORIZED.
8. No commit/push/merge/tag without separate Owner authorization.

See `docs/DECISION_LOG.md → DEC-019 CLOSURE`, `docs/PROJECT_STATE.md`,
`docs/07_ROADMAP_AND_GATES.md §3.2.5`, and
`docs/DEC-019_STAFF_PROFILE_CREDENTIAL_MANAGEMENT.md §16`.
