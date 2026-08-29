# 14 — Admin Boundary / User Management — Implementation Contract

**Status:** OWNER LOCKED (requirements) — **Implementation status: CLOSED — OWNER ACCEPTED (2026-08-30)**
**Version:** 0.2
**Authority:** DEC-018 (2026-08-29); closure per DEC-018 CLOSURE (2026-08-30)
**Data:** SYNTHETIC ONLY — NO real-patient runtime, NO production deployment.

External review: CLOSED — PASS (independent review pass completed before Owner lock).

**Closure note (2026-08-30):** T0 → T8 complete and OWNER ACCEPTED. T7 Fresh
Codex independent focused audit completed — 1 MEDIUM finding (disabled
Investigation assignee eligibility) remediated and Owner-accepted as closed;
T8 Owner Synthetic Acceptance PASS incl. T8.9 Last Clinic Admin protection
PASS. The locked requirements below are unchanged and remain the authority for
this delivered v1. Full detail: `docs/DECISION_LOG.md` → "DEC-018 CLOSURE".

---

## 0. Baseline

| Item | Value |
|---|---|
| Repository | `/home/blockchain/projects/gastrocare` |
| Branch | `correction/owner-acceptance-slice1-3` |
| Governance HEAD before work package | `5a7fd67321037fe8ee4c4b3b9fc62dfc2ea5f376` |
| DEC-016 implementation checkpoint | `6dd8d5226b6f4d2c264227226cb996900aa3d9f6` |
| DEC-016 independent audit | CLOSED — PASS (Fresh Codex Session B, 2026-08-29) |

Execution sequence: `T0 → T1 → T2 → T3 → T4 → T5 → T6` (Claude Code, continuous),
then `T7` = Fresh Codex independent focused read-only audit (NOT self-performed),
then `T8` = Owner Synthetic Acceptance (NOT self-closed).

---

## 1. Owner-locked authority (DEC-018)

1. Operational roles unchanged: `DOCTOR`, `NURSE`, `RECEPTIONIST`. No `ADMIN`
   value added to `AuthRole`.
2. Clinic Admin is an independent capability: `AuthUser.isClinicAdmin`. Any
   ACTIVE tenant user may hold it. Operational role never confers administrative
   authority.
3. `AuthUser.tenantId` remains REQUIRED (NOT NULL).
4. System Admin is a separate identity realm (`SystemAdminUser`) — DEFERRED,
   out of scope for this work package.
5. System Admin has no clinical access by default.
6. Canonical Clinic Admin routes: `/clinic-admin/*`. Legacy frontend `/admin/*`
   removed, no redirect.
7. Tenant JWT v1 contains only `sub`, `realm = TENANT`, `sessionVersion`. JWT
   never carries `role`, `tenantId`, `email`, `isClinicAdmin` as authority. All
   request authority resolves from the current `AuthUser` row in DB.
8. Last Clinic Admin invariant is concurrency-safe: `SERIALIZABLE` transaction,
   NO automatic retry, serialization/write conflict → `409`. Mandatory concurrent
   acceptance test required.
9. DEC-018 supersedes only the admin-route / admin-visibility portion of DEC-017
   Demo Navigation v1. Clinical-first navigation and terminology unchanged.
10. Implementation T0→T8 authorized per this Contract with synthetic data only.

---

## 2. Hard out of scope

`SystemAdminUser`, `/system-admin/*`, System Admin UI, `SystemAuditEvent`,
break-glass access, generic permission engine, custom RBAC, SSO, MFA, SCIM,
email invitation infrastructure, tenant impersonation, global form-template
builder, CORE-05, AI, real-patient runtime, production.

No change to clinical semantics of DEC-010 → DEC-016.

---

## T0 — Preflight + governance persistence

- T0.1 Preflight: `git branch --show-current`, `git rev-parse HEAD`,
  `git status --short`, `git diff --check`, `git log -5`. Read Startup Protocol
  docs + `04`, `05`, `06`, `DEC016_OWNER_AUTHORITY.md`,
  `13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md`. STOP — BLOCKED if branch wrong or
  unexplained dirty application/schema/test files. No reset/stash/clean/restore.
- T0.2 Persist DEC-016 independent audit closure (Fresh Codex Session B: PASS,
  R1–R5 PASS, 27/27 targeted, migration probe PASS, Prisma validation PASS,
  findings NONE, blockers NONE, no files changed) into current-state sections of
  `DECISION_LOG.md`, `PROJECT_STATE.md`, `07_ROADMAP_AND_GATES.md`. Do not
  rewrite historical evidence. Owner product acceptance remains NOT CLAIMED.
- T0.3 Persist DEC-018 authority block in `DECISION_LOG.md`.
- T0.4 Create this Contract file (OWNER LOCKED, v0.2).
- T0.5 Update `PROJECT_STATE.md` + `07_ROADMAP_AND_GATES.md`: current work
  package `DEC-018 — ADMIN BOUNDARY / USER MANAGEMENT v1 — OWNER LOCKED —
  IMPLEMENTATION AUTHORIZED`; DEC-016 audit `CLOSED — PASS`; execution sequence
  `T0 → T8`; real data / production `NOT AUTHORIZED`.

---

## T1 — Schema / migration / explicit bootstrap

Modify `AuthUser`, add:

```prisma
displayName        String?
isClinicAdmin      Boolean        @default(false)
status             AuthUserStatus @default(ACTIVE)
mustChangePassword Boolean        @default(false)
sessionVersion     Int            @default(0)
updatedAt          DateTime       @updatedAt
```

Add enum:

```prisma
enum AuthUserStatus {
  ACTIVE
  DISABLED
}
```

Preserve: `tenantId` NOT NULL, `email` globally unique, existing `role`,
existing `passwordHash`, historical identity/provenance.

Migration must be additive. Existing rows deterministic: `status = ACTIVE`,
`isClinicAdmin = false`, `mustChangePassword = false`, `sessionVersion = 0`.

NO heuristic admin backfill (no "first DOCTOR", no "oldest user", no hard-coded
production UUID, no inferred email).

Update synthetic pilot seed explicitly so the designated pilot admin has
`role = DOCTOR` and `isClinicAdmin = true`, reusing the existing explicit
synthetic pilot/default clinician identity. No production identity in migration.

Run real PostgreSQL migration validation + backup/restore regression required by
repository governance.

---

## T2 — Authentication / current authority / session revocation

- Tenant access token contains only `sub`, `realm = TENANT`, `sessionVersion`.
  No `role` / `tenantId` / `email` / `isClinicAdmin` as authority.
- `POST /auth/login`: require user exists, `status == ACTIVE`, password matches;
  otherwise generic credentials failure.
- `JwtStrategy.validate` after signature/expiry: (1) require `realm == TENANT`;
  (2) load current `AuthUser` by `sub`; (3) reject missing; (4) reject
  `status != ACTIVE`; (5) reject `payload.sessionVersion != user.sessionVersion`;
  (6) build `AuthenticatedUser` exclusively from DB: `userId`, `tenantId`,
  `email`, `role`, `isClinicAdmin`, `mustChangePassword`.
- `GET /auth/me`: safe current-user info for frontend. No `passwordHash` / session
  secrets.
- Forced password change: when `mustChangePassword == true`, only `GET /auth/me`
  and `POST /auth/change-password` (plus auth/logout client behavior) allowed;
  every other application action rejected until password changed.
- `POST /auth/change-password`: on success set `mustChangePassword = false`,
  `sessionVersion += 1`. Old token invalid immediately.

---

## T3 — Clinic Admin authorization + user management API

- `ClinicAdminGuard` (focused, no generic permission engine): require
  authenticated, `status == ACTIVE`, `isClinicAdmin == true`,
  `mustChangePassword == false`.
- Namespace `/clinic-admin/users`. Endpoints:

```
GET    /clinic-admin/users
GET    /clinic-admin/users/:id
POST   /clinic-admin/users
PATCH  /clinic-admin/users/:id
POST   /clinic-admin/users/:id/disable
POST   /clinic-admin/users/:id/reactivate
POST   /clinic-admin/users/:id/reset-password
GET    /clinic-admin/users/:id/audit
```

- Every target lookup scoped by `id + currentUser.tenantId`. Client cannot
  override tenant authority. No DELETE endpoint.
- PATCH may change only `displayName`, `role`, `isClinicAdmin`. No tenant switch.
- Create user: server generates cryptographically strong random temporary
  password; set `mustChangePassword = true`; return plaintext temp password
  exactly once; never persist plaintext; never place it in `AuditEvent`, logs,
  exceptions, test snapshots, documentation fixtures.
- Reset password: new temp password, `mustChangePassword = true`,
  `sessionVersion += 1`; old sessions immediately invalid.

---

## T4 — Lifecycle / concurrency / audit / facility-room boundary

- Disable: `status = DISABLED`, `sessionVersion += 1`. No provenance rewrite.
  Disabled account cannot login, old token rejected, cannot act, cannot be new
  clinician target / handover target / new assignment target.
- Reactivate: `status = ACTIVE`. Do NOT auto-restore revoked Clinic Admin
  capability. Do NOT auto-reset/change password.
- Clinician filtering (`clinicians.service.ts`): every selectable/resolvable
  clinician query additionally requires `status = ACTIVE` — covers
  `resolveDefaultClinician`, `assertClinicianInTenant`, `listClinicians`
  (default clinician, explicit assignment, handover selection).
- DOCTOR → non-DOCTOR role change: reject only if the source can authoritatively
  establish the user remains responsible clinician for an ACTIVE CareEpisode
  without handover/reconciliation. Do NOT block solely for historical Encounter
  references. Do NOT infer active responsibility from free text / frontend state
  / heuristic. `InvestigationOrder` lacks authoritative lifecycle status — do NOT
  invent completion semantics. If required reconciliation cannot be determined
  from the authoritative model: STOP that semantic expansion and report the exact
  blocker.
- Last Clinic Admin invariant: tenant always retains ACTIVE Clinic Admin count
  ≥ 1. Protect `disable` and `revoke isClinicAdmin` with a `SERIALIZABLE`
  transaction, NO automatic retry, serialization/write conflict → `409 Conflict`.
  Mandatory concurrency test: two ACTIVE Clinic Admins, concurrent
  revoke/disable of each — both cannot succeed, max one commits, other
  rejects/conflicts, final ACTIVE count ≥ 1, audit records only committed
  mutation. Reuse the proven Slice 3 T4 concurrency approach where applicable.
- Facility/Room boundary: `POST /facilities` and `POST /rooms` require Clinic
  Admin capability (not operational DOCTOR role). Existing legitimate GET/read
  behavior may remain. No delete / rename / status lifecycle added.
- Audit (tenant `AuditEvent`) required actions: `USER_CREATED`,
  `USER_PROFILE_UPDATED`, `USER_ROLE_CHANGED`, `USER_CLINIC_ADMIN_GRANTED`,
  `USER_CLINIC_ADMIN_REVOKED`, `USER_DISABLED`, `USER_REACTIVATED`,
  `USER_PASSWORD_RESET`, `FACILITY_CREATED`, `ROOM_CREATED`. Never audit
  password / temporaryPassword / passwordHash / accessToken / JWT / secret.
  Business mutation + audit atomic where consistency requires. User audit read
  endpoint exposes only user-management events.

---

## T5 — Frontend

- Frontend authority from `GET /auth/me`. Never decode JWT for role/admin state.
- Canonical routes `/clinic-admin/users`, `/clinic-admin/facilities`. Delete
  legacy `/admin/users`, `/admin/facilities`. No redirect. Update/delete old-path
  tests intentionally.
- Sidebar: preserve clinical-first navigation. `Quản trị` group visible only if
  `isClinicAdmin == true`. Phase 1 items: `Người dùng`, `Cơ sở & phòng`. Form
  Templates not turned into an editable builder.
- UsersPage: functional UI — list/search (displayName, email, role, status,
  Clinic Admin marker), create, edit, change role, grant/revoke Clinic Admin,
  reset password, disable/reactivate, view user-management audit. Temporary
  password shown once, not persisted longer than needed.

---

## T6 — Validation / regression

Run full required validation: backend targeted auth/admin E2E, last-admin real
PostgreSQL concurrency tests, tenant-isolation tests, full backend E2E, frontend
unit/component, backend build, frontend build/typecheck, relevant browser
acceptance, Prisma migration validation, backup/restore, `git diff --check`,
privacy/secret scan.

Gate B cases (SAME-token authority freshness): role change reflected on reused
token; Clinic Admin revoke → `/clinic-admin/*` immediate DENY on reused token;
disable → next request rejected on reused token; password reset → old token
rejected. Plus: ACTIVE login PASS, DISABLED login FAIL, forced password change
works, old token invalid after change-password.

Authorization matrix: ordinary DOCTOR / NURSE / RECEPTIONIST → clinic-admin DENY;
DOCTOR+ClinicAdmin / NURSE+ClinicAdmin / RECEPTIONIST+ClinicAdmin → ALLOW.
Clinical permissions remain operational-role based.

Tenant cases: Tenant A admin cannot list/read/edit/disable/reset Tenant B user;
foreign ID non-leak preserved; spoof `tenantId` cannot override authenticated
tenant.

Facility/Room: ordinary DOCTOR POST → DENY; ClinicAdmin POST → ALLOW; read
regression PASS.

---

## T7 — Fresh Codex independent focused read-only audit (NOT self-performed)

After T6 PASS, STOP implementation. Prepare worktree for a fresh Codex session.
Audit focus: auth/session revocation, DB-backed current authority, tenant
isolation, Clinic Admin boundary, last-admin SERIALIZABLE concurrency,
migration/backfill, Facility/Room authorization correction, secret handling.
Claude Code MUST NOT declare T7 independently verified.

---

## T8 — Owner Synthetic Acceptance (NOT self-closed)

Prepare synthetic acceptance workflow for Owner: Clinic Admin login → create
DOCTOR → temp password once → new user login → forced password change → normal
DOCTOR access → role change → grant/revoke Clinic Admin → create Facility/Room →
view user-management audit → disable user → old token rejected → reactivate user
→ concurrent/last-admin protection demonstrated. Only Owner marks T8 PASS.

---

## Stop conditions

STOP and report if implementation requires: `AuthUser.tenantId` nullable;
operational role used as admin authority; SystemAdmin implementation; generic
permission engine; new clinical semantics; heuristic Investigation lifecycle;
historical provenance rewrite; real patient data; production deployment; CORE-05;
break-glass. Also STOP if migration cannot preserve existing identity/data
invariants.

## Git governance

No `git commit` / `push` / `merge` / `tag` / new branch / reset / stash / clean
unless Owner separately authorizes. Do not self-certify as independent reviewer.
