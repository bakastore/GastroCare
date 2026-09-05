# GASTROCARE — DEC-021 PACKAGE R IMPLEMENTATION CONTRACT

## Selective Clinical Rebaseline — Core Correction

**Trạng thái:** `OWNER LOCKED v0.5 FINAL — IMPLEMENTATION CHƯA ĐƯỢC AUTHORIZE`

**Authority:** `DEC-021 v0.3 — OWNER LOCKED` + Owner Decision: Structured Treatment Activation accepted at conceptual level + Owner Decision: NR-01 authority scope (2026-09-05)

**Baseline for analysis:** `main @ 27500091f268b97d7abd9b59afa1e2c2d6d72f7a`

**Package:** `R — DEC-021 Selective Rebaseline Core Correction`

**Data:** `SYNTHETIC DATA ONLY`

**Owner Lock:** `APPROVED — Package R Implementation Contract v0.5 FINAL`

**v0.2 focused corrections:**

- restore mandatory `reopenReason` + lifecycle/activation audit semantics for `REOPEN_EXISTING`;
- mark NR-01 Doctor-vs-care-staff authority as explicit `OWNER DECISION REQUIRED`, no silent narrowing of DEC-021.

**v0.3 focused correction:**

- resolve NR-01 authority per explicit Owner Decision: `AuthRole.NURSE` được thêm vào đúng 2 endpoint `contact-attempt` và `lost-to-follow-up`, tái dùng `AuthRole` enum và cơ chế `@Roles(...)` decorator hiện có — không mở capability system mới; STOP condition tương ứng được gỡ.

**v0.4 focused corrections (đã Claude Chat verify trên schema/code thật trước khi đưa vào bản này):**

- khoá **machine-checkable handover acceptance linkage** cho NR-04: `ENCOUNTER_HANDOVER_ACCEPTED` phải bind chính xác tới `ClinicianAssignmentHistory.id` mới nhất (field `previousClinicianId` đã tồn tại sẵn trong schema); acceptance của handover cũ không thể thoả handover mới; idempotent nếu accept lặp lại đúng assignment mới nhất — đây là tinh chỉnh chính xác hoá NR-04 đã được phép, không phải quyền/scope mới, không cần Owner Decision riêng;
- vá đúng rủi ro thật đã verify trong `CareTasksController` (`@Roles(AuthRole.DOCTOR)` đặt ở **class level**, áp dụng cho mọi method bao gồm `GET /care-tasks`, `complete`, `reschedule`): thêm NURSE bằng **method-level** **`@Roles`** **override CHỈ trên 2 method mới** (`contact-attempt`, `lost-to-follow-up`), không sửa class-level decorator — đạt đúng mục tiêu cô lập quyền NURSE mà không cần dựng endpoint/projection riêng.

**v0.5 final focused disposition (GPT review; pending Owner Lock of this Contract):**

- nâng cấp handover linkage lên dùng `AuditEvent.seq` (deterministic append-order, đã verify tồn tại) + `assignmentHistoryId` trong metadata, thay vì "latest theo assignment order" mơ hồ ở v0.4 — vá đúng lỗ hổng "latest xác định bằng gì" trong bản v0.4;
- **BỎ KHỎI PACKAGE R**: `GET /care-tasks/follow-up-worklist` và mọi implementation/test liên quan — ý tưởng đúng nhưng chưa đúng thời điểm (chưa có UI nurse nào gọi tới trong Package R hiện tại);
- ghi **DEFERRED**: NURSE discovery/worklist API + UI, chỉ làm khi product workflow thực sự cần.

---

## 1. Mục tiêu

Package R triển khai phần core bị DEC-021 thay đổi trực tiếp trước khi Package B được mở lại:

- D20-02 — CareEpisode creation/start.
- D20-03 — Episode closure + future Episode-linked CareTask disposition.
- NR-01 — Lost to Follow-up.
- NR-03 — Explicit Start / End Encounter.
- NR-04 — Doctor Handover / Delegation.
- NR-07 — Patient declines all treatment.
- Phần tối thiểu của Treatment Decision cần cho Structured Treatment Activation.

**Không thuộc Package R:**

- NR-02 Duplicate Patient merge — DEFERRED.
- NR-05 Prescription dispensed-lock — DEFERRED.
- NR-06 surgery team note — chuyển sang Package B reconciled scope.
- Full pharmacy / Prescription subsystem.
- Full diagnosis redesign / ICD.
- Multi-specialty redesign.
- AI clinical reasoning.

---

## 2. VERIFIED current-source findings

### 2.1 Encounter

`backend/prisma/schema.prisma` hiện:

- không có lifecycle status cho clinical examination;
- không có `clinicalStartedAt` / `clinicalEndedAt`;
- `workflowKind` chỉ có `HEMORRHOID_INITIAL`;
- `responsibleClinicianId` + `ClinicianAssignmentHistory` đã tồn tại;
- handover hiện là DOCTOR-only, audited, transactionally guarded.

### 2.2 D20-02

Current implementation:

- HEMORRHOID\_INITIAL bị ép `episodeId = null`;
- first Return mới create/reuse HEMORRHOID\_TREATMENT episode;
- `TreatmentPathway.caseId` bắt buộc CareEpisode;
- không có Prescription entity;
- CarePlan không có `treatmentDomain`;
- Treatment Decision v2 không phân biệt machine-readable `proposal` vs `effective treatment`.

Kết luận: không thể implement DEC-021 D20-02 bằng current model mà không invent heuristic.

### 2.3 D20-03

Current:

- `CareTaskStatus = OPEN | COMPLETED | CANCELLED`;
- không có CLOSED;
- Episode close hiện không cancel/touch CareTask;
- CareTask `complete/reschedule/cancel` dùng read-then-write; chưa có guarded transition đồng bộ với Episode close.

### 2.4 Single-active invariant

Current:

- application uses Serializable transactions + count guard;
- chưa có DB-level unique invariant cho: `(tenantId, patientId, episodeType=HEMORRHOID_TREATMENT, status=ACTIVE)`.

---

## 3. Structured Treatment Activation — contract design

### 3.1 Không tạo generic TreatmentActivation subsystem

Structured Treatment Activation trong Package R là **explicit transactional application command**, không phải full Prescription/Pharmacy subsystem và không phải generic multi-specialty framework.

Canonical operation:

`POST /encounters/:id/hemorrhoid-treatment/activate`

DOCTOR-only.

### 3.2 Treatment Decision v3 — machine-readable source

Tạo `HEMORRHOID_TREATMENT_DECISION v3` bằng code-config; historical v1/v2 giữ nguyên.

v3 phải tách tối thiểu:

- `proposedModalities[]` — Doctor proposal.
- `patientDecision`: 
  - `ACCEPTED`
  - `UNDECIDED`
  - `DECLINED_ALL`
- `effectiveModalities[]` — modalities thực sự được kích hoạt trong đợt điều trị hiện tại.
- `decisionSummary` — free text, giữ nguyên narrative.
- care-setting fields hiện có chỉ hiển thị khi modality tương ứng cần chúng.

Rules:

- `UNDECIDED` → không activation.
- `DECLINED_ALL` → `effectiveModalities = []`, không activation, không CareEpisode.
- `ACCEPTED` + non-empty `effectiveModalities` → đủ điều kiện cho explicit activation.
- `Actual treatment performed` vẫn là factual downstream event; không suy ra từ activation.

### 3.3 Relational domain linkage

Đề xuất schema tối thiểu trên `Encounter`:

- `treatmentActivationSubmissionId String? @unique`
- `treatmentActivatedAt DateTime?`
- FK `treatmentActivationSubmissionId -> ClinicalFormSubmission.id`

Không thêm `treatmentDomain` free-standing field.

Machine-checkable linkage được xác lập bằng toàn bộ chain:

`Encounter`
→ `treatmentActivationSubmissionId`
→ completed `HEMORRHOID_TREATMENT_DECISION v3`
→ explicit `effectiveModalities`
→ `Encounter.episodeId`
→ `CareEpisode.episodeType = HEMORRHOID_TREATMENT`

Không dùng:

- Diagnosis free-text;
- same Encounter alone;
- temporal proximity;
- CarePlan existence alone;
- reminder existence alone.

### 3.4 Activation transaction

Trong một `Serializable` transaction:

1. Load Encounter by `tenantId + id`.
2. Require Encounter thuộc đúng patient/tenant và không ở terminal state.
3. Load exact `sourceDecisionSubmissionId`.
4. Require: 
   - same tenant/patient/encounter;
   - template = `HEMORRHOID_TREATMENT_DECISION`;
   - version >= 3;
   - latest completed head of its amendment chain;
   - `patientDecision = ACCEPTED`;
   - `effectiveModalities` non-empty.
5. Resolve HEMORRHOID\_TREATMENT episode: 
   - `>1 ACTIVE` → 409 DATA/WORKFLOW CONFLICT.
   - `1 ACTIVE` → reuse.
   - `0 ACTIVE + no CLOSED history` → create new.
   - `0 ACTIVE + CLOSED history` → require explicit preserved recurrence action: 
     - `REOPEN_EXISTING <id>` **requires** **`reopenReason`** **non-empty**;
     - `START_NEW`.
   - `REOPEN_EXISTING` must preserve the existing Reopen invariant: reason + actor + AuditEvent.
6. Guard/update active episode row.
7. Set on Encounter atomically: 
   - `episodeId`;
   - `treatmentActivationSubmissionId`;
   - `treatmentActivatedAt`.
8. Emit `HEMORRHOID_TREATMENT_ACTIVATED` AuditEvent: 
   - identifiers + modalities + recurrence operation;
   - when recurrence operation = `REOPEN_EXISTING`, include the trimmed `reopenReason`;
   - no other clinical narrative. The underlying reopen operation must also preserve its existing `CARE_EPISODE_REOPENED` audit semantics; activation audit does not replace the lifecycle audit.
9. Commit once.

Idempotency:

- same Encounter + same `treatmentActivationSubmissionId` → return existing resolved state;
- different activation submission after activation → 409; correction must use ClinicalForm amendment + explicit re-evaluation flow, never overwrite activation history.

### 3.5 TreatmentPathway

`TreatmentPathway` remains child of CareEpisode.

Activation MAY create/link TreatmentPathway only when an existing locked pathway rule is sufficient.
It is **not required** for D20-02 domain proof.

No heuristic selection of a pathway when multiple modalities/pathways exist.

---

## 4. Single-active Episode invariant

### 4.1 DB final guard — required migration

Add PostgreSQL partial unique index:

```sql
CREATE UNIQUE INDEX "care_episodes_one_active_hemorrhoid_per_patient"
ON "care_episodes" ("tenantId", "patientId")
WHERE "episodeType" = 'HEMORRHOID_TREATMENT'
  AND "status" = 'ACTIVE';

```

Purpose:

- final DB guard against future code paths bypassing Serializable helper;
- application still uses Serializable transactions and maps uniqueness/serialization conflicts to HTTP 409;
- no automatic retry.

Before migration:

- verify no existing duplicate ACTIVE HEMORRHOID\_TREATMENT rows;
- if duplicates exist: STOP, do not auto-merge or auto-close.

---

## 5. Encounter lifecycle — NR-03

Add nullable schema fields to preserve historical truth:

```text
EncounterClinicalStatus?:
  REGISTERED
  IN_PROGRESS
  COMPLETED

clinicalStartedAt DateTime?
clinicalEndedAt   DateTime?

```

Policy:

- NO historical backfill.
- historical `clinicalStatus = null` means legacy/unknown, not REGISTERED.
- new Encounter Context → `REGISTERED`.
- `POST /encounters/:id/start` 
  - DOCTOR-only;
  - REGISTERED → IN\_PROGRESS;
  - set `clinicalStartedAt`;
  - audited.
- `POST /encounters/:id/end` 
  - DOCTOR-only;
  - IN\_PROGRESS → COMPLETED;
  - set `clinicalEndedAt`;
  - audited.
- receptionist record creation time != clinical start.
- `occurredAt` remains existing encounter occurrence/timing field; it is not redefined as clinicalStartedAt.

Structured Treatment Activation requires new-format Encounter in `IN_PROGRESS`.

---

## 6. Handover / receiving Doctor — NR-04

Preserve existing:

- `responsibleClinicianId`;
- `ClinicianAssignmentHistory`;
- current transactional handover;
- no history overwrite.

Add explicit receiving action:

`POST /encounters/:id/accept-handover`

Rules:

- only current `responsibleClinicianId` Doctor may accept;
- requires current Encounter `IN_PROGRESS`;
- append `ENCOUNTER_HANDOVER_ACCEPTED` AuditEvent;
- no mutation of historical ClinicianAssignmentHistory row.

### 6.1 Machine-checkable handover linkage

**VERIFIED against schema/code:** `AuditEvent.seq Int @default(autoincrement()) @@unique([seq])` đã tồn tại — dùng làm deterministic append-order key. `ENCOUNTER_CLINICIAN_HANDOVER` audit action đã tồn tại trong `encounters.service.ts`, hiện metadata chưa có `assignmentHistoryId` — đây là bổ sung additive, không phải hành vi mới.

A handover MUST have one machine-checkable bridge between the existing `ENCOUNTER_CLINICIAN_HANDOVER` AuditEvent and the exact new `ClinicianAssignmentHistory` row created by that handover.

Inside the existing handover transaction:

1. create the new `ClinicianAssignmentHistory` row and retain `assignment.id`;
2. update `Encounter.responsibleClinicianId` with the existing guarded concurrency semantics;
3. write the existing handover audit with:

```text
action     = ENCOUNTER_CLINICIAN_HANDOVER
entityType = Encounter
entityId   = encounterId
metadata   = {
  previousClinicianId,
  newClinicianId,
  assignmentHistoryId = assignment.id,
  reason
}

```

The transaction MUST commit assignment history + responsibility transition + audit atomically.

### 6.2 Deterministic latest-handover resolution

The authoritative latest handover for an Encounter is resolved by:

```text
AuditEvent
where:
  action     = ENCOUNTER_CLINICIAN_HANDOVER
  entityType = Encounter
  entityId   = encounterId
order by:
  seq DESC
take:
  1

```

Then load `ClinicianAssignmentHistory` using `metadata.assignmentHistoryId`.

Do NOT determine latest handover by:

- `assignedAt` alone;
- timestamp proximity;
- free text;
- current Encounter id alone;
- arbitrary array ordering.

After loading the assignment row, require:

- `assignment.encounterId == encounter.id`;
- `assignment.clinicianId == encounter.responsibleClinicianId`;
- `assignment.previousClinicianId != null`;
- audit `metadata.newClinicianId == encounter.responsibleClinicianId`.

Mismatch → `409 DATA/WORKFLOW CONFLICT`; do not infer or repair automatically.

### 6.3 Accept-handover

`POST /encounters/:id/accept-handover`

Within one transaction:

1. require Encounter `IN_PROGRESS`;
2. require authenticated Doctor is current `responsibleClinicianId`;
3. resolve the exact latest handover per §6.2;
4. require no existing acceptance for that exact assignment;
5. append:

```text
action     = ENCOUNTER_HANDOVER_ACCEPTED
entityType = ClinicianAssignmentHistory
entityId   = assignmentHistoryId
actorId    = current responsible Doctor
metadata   = { encounterId, clinicianId }

```

Idempotency:

- repeated acceptance of the exact same latest assignment by the same responsible Doctor returns already-accepted state and MUST NOT append a duplicate acceptance event;
- a later handover creates a different `ClinicianAssignmentHistory.id`, therefore acceptance bound to an older assignment NEVER satisfies the new handover.

### 6.4 End-Encounter guard after handover

Before `POST /encounters/:id/end` commits:

- if no handover exists after the initial assignment → no receiving acceptance is required;
- otherwise resolve the latest handover per §6.2;
- require matching `ENCOUNTER_HANDOVER_ACCEPTED` where: 
  - `entityType = ClinicianAssignmentHistory`;
  - `entityId = latest assignmentHistoryId`;
  - `actorId = current Encounter.responsibleClinicianId`.

If not present → reject with conflict; do not end Encounter.

No mutation of historical `ClinicianAssignmentHistory` rows. No new handover entity. No generic permission-engine redesign.

---

## 7. D20-03 Episode close + CareTask disposition

### 7.1 Deterministic terminal mapping

Current persisted statuses support no CLOSED state.

Package R locks:

`OPEN Episode-linked CareTask → CANCELLED`

when Doctor confirms Episode close.

Reason:
`EPISODE_CLOSED`.

Do not alter:

- COMPLETED tasks;
- already CANCELLED tasks;
- LOST\_TO\_FOLLOW\_UP tasks;
- tasks without authoritative Episode linkage.

### 7.2 Authoritative Episode linkage for task disposition

A task is Episode-linked only when machine-checkable:

Generic CarePlan task:
`CareTask.carePlan -> CarePlan.encounter.episodeId == episode.id`

Longo/source task:
`CareTask.sourceEncounter.episodeId == episode.id`

No heuristic for historical unlinked tasks.

### 7.3 Atomic close

One Serializable transaction:

1. verify Doctor authority + ACTIVE Episode;
2. resolve authoritative linked OPEN tasks;
3. transition Episode ACTIVE → CLOSED;
4. guarded transition linked tasks OPEN → CANCELLED;
5. set `cancelledAt`;
6. write one Episode close AuditEvent;
7. write one task disposition AuditEvent per changed task with: 
   - reason = `EPISODE_CLOSED`;
   - actor;
   - timestamp via AuditEvent;
8. commit atomically.

No hard-delete.

### 7.4 Concurrency correction

`CareTasksService.complete/reschedule/cancel` must move from read-then-write to guarded transactional state transitions.

At minimum:

- authoritative read inside transaction;
- `updateMany where id + tenantId + status=OPEN`;
- affected-row count must be exactly 1;
- audit written in same transaction;
- concurrent Episode close vs complete/reschedule/cancel → one commits, loser → 409;
- no automatic retry.

---

## 8. Lost to Follow-up — NR-01

Add `LOST_TO_FOLLOW_UP` to `CareTaskStatus`.

Add:

- `lostToFollowUpAt DateTime?`
- `lostToFollowUpReason String?`

Add append-only contact-attempt model:

```text
CareTaskContactAttempt
- id
- tenantId
- careTaskId
- actorId
- attemptedAt
- note String?

```

No invented contact-channel taxonomy in v1.

Endpoints:

- `POST /care-tasks/:id/contact-attempt`
- `POST /care-tasks/:id/lost-to-follow-up`

**OWNER DECISION — RESOLVED 2026-09-05**

DEC-021 NR-01 allows `authorized Doctor / authorized care staff`.
Owner đã chốt: Package R mở rộng quyền cho `AuthRole.NURSE` bên cạnh
`AuthRole.DOCTOR`, áp dụng đúng và chỉ cho hai endpoint dưới đây —
tái dùng role đã tồn tại sẵn trong hệ thống và cơ chế `@Roles(...)`
decorator hiện hành. Đây KHÔNG phải việc mở một capability system mới.

Authorization cụ thể:

```text
@Roles(AuthRole.DOCTOR, AuthRole.NURSE)
POST /care-tasks/:id/contact-attempt
POST /care-tasks/:id/lost-to-follow-up

```

`AuthRole.RECEPTIONIST` KHÔNG được thêm vào hai endpoint này trong
Package R — theo đúng phạm vi vai trò đã ghi trong schema
(`RECEPTIONIST: patient registration/lookup only, no detailed clinical content`); lý do liên hệ thất bại và lý do mất dấu theo dõi
được coi là nội dung có tính lâm sàng. Mở rộng cho RECEPTIONIST (nếu
cần) là một quyết định riêng, ngoài phạm vi Package R.

Mọi endpoint khác của Package R (activation §3.1, Encounter start/end
§5, Episode close §7, handover §6) giữ nguyên DOCTOR-only, không bị
ảnh hưởng bởi quyết định này.

### 8.1 Cô lập quyền NURSE — method-level override, không sửa class-level decorator

**VERIFIED against code:** `CareTasksController` hiện đặt `@Roles(AuthRole.DOCTOR)` ở **class level** (`backend/src/care-tasks/care-tasks.controller.ts`), áp dụng mặc định cho **mọi** method trong controller — bao gồm `GET /care-tasks` (`list()`, trả về toàn bộ CareTask của tenant), `POST /:id/complete`, `POST /:id/reschedule`.

**Rủi ro thật nếu implement sai:** nếu sửa thẳng decorator class-level thành `@Roles(AuthRole.DOCTOR, AuthRole.NURSE)`, NURSE sẽ vô tình có quyền truy cập `list/complete/reschedule` — vượt xa phạm vi 2 endpoint Owner đã cho phép.

**Yêu cầu triển khai bắt buộc:**

```text
KHÔNG sửa @Roles(AuthRole.DOCTOR) ở class-level của CareTasksController.

CHỈ thêm method-level @Roles override, ĐÚNG và CHỈ trên 2 method mới:

  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Post(':id/contact-attempt')
  contactAttempt(...) { ... }

  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Post(':id/lost-to-follow-up')
  markLostToFollowUp(...) { ... }

Các method còn lại (list, complete, reschedule, cancel) giữ nguyên, không thêm
decorator gì cả — tự động kế thừa @Roles(AuthRole.DOCTOR) từ class,
tức vẫn DOCTOR-only.

```

Không tạo **read/discovery endpoint hoặc projection riêng cho NURSE** trong Package R.
Không mở rộng `GET /care-tasks` cho NURSE dưới bất kỳ hình thức nào trong Package R.
DTO/input validation cần thiết cho chính hai mutation đã được Owner cho phép
(`contact-attempt`, `lost-to-follow-up`) vẫn thuộc implementation scope bình thường.
Nếu implementer phát hiện method-level override không đủ để cô lập quyền đúng cách
theo cơ chế guard hiện tại của dự án → `STOP → Owner/Claude Chat review`, không tự
sáng tạo giải pháp thay thế.

**DEFERRED — ngoài phạm vi Package R:** NURSE discovery/worklist API + UI.

Mục này chỉ được mở khi product workflow thực sự cần NURSE tự tra cứu task thay vì
nhận một CareTask đã được xác định. Khi mở lại, read model phải tuân thủ
least-privilege; không mặc nhiên mở generic `GET /care-tasks`.
Package R không implementation, không test và không migration cho discovery/worklist.

Rules:

- only OPEN task may become LOST\_TO\_FOLLOW\_UP;
- reason required and trimmed;
- overdue alone never auto-labels LOST\_TO\_FOLLOW\_UP;
- contact attempts are append-only;
- lost task is terminal for Package R and is not auto-cancelled on later Episode close.

---

## 9. Patient declines all treatment — NR-07

Treatment Decision v3:

`patientDecision = DECLINED_ALL`

requires:

- `effectiveModalities = []`;
- no Structured Treatment Activation;
- no CareEpisode created;
- treatment-linked CarePlan/follow-up forbidden.

Encounter may then be explicitly ended.

Outcome represented in v3 structured response:
`outcome = PATIENT_DECLINED_TREATMENT`
`disposition = SELF_MONITORING`

No new Episode solely to represent refusal.

If patient returns later:

- create new Encounter;
- new assessment;
- Episode starts only after a valid new activation.

---

## 10. Historical-data policy

Default = **NO BACKFILL / NO REWRITE**.

Do not backfill:

- `Encounter.episodeId`;
- `treatmentActivationSubmissionId`;
- clinical lifecycle status/timestamps;
- historical task Episode linkage;
- TreatmentPathway;
- CareEpisode creation dates.

Existing DEC-020/Package A historical rows remain evidence of the rules in force when created.

Migration may:

- add nullable fields/tables/enums;
- add partial unique index only after duplicate-active precheck.

If existing data violates the new partial unique index:
`STOP → OWNER DECISION`.
No auto-close, merge, delete, or fabricated activation.

---

## 11. Package B reconciliation boundary

Package B old Contract remains historical authority but stays:
`HOLD / T0 NOT OPEN`.

After Package R closes:

- Package B Contract must be rebaselined to consume: 
  - Treatment Decision v3;
  - Encounter explicit lifecycle;
  - new Episode linkage;
  - LOST\_TO\_FOLLOW\_UP;
  - D20-03 terminal semantics.
- NR-06 lightweight surgery-team note is assigned to Package B reconciled form-fidelity scope.
- Package B must not reimplement Package R lifecycle logic.

---

## 12. Migration write scope — proposed

Expected schema/migration impact:

- `backend/prisma/schema.prisma`
- one new additive migration: 
  - Encounter clinical lifecycle enum + nullable fields;
  - Encounter treatment activation FK/timestamp;
  - CareTaskStatus add LOST\_TO\_FOLLOW\_UP;
  - CareTask lost fields;
  - CareTaskContactAttempt table;
  - CareEpisode partial unique active-Hemorrhoid index.

No rewrite of old migration files.

---

## 13. Minimum backend acceptance tests

Must prove:

1. Initial consult only → no Episode.
2. PROPOSED/UNDECIDED → no activation, no Episode.
3. DECLINED_ALL → Encounter can close, no Episode.
4. ACCEPTED + activation → Episode ACTIVE at activation Encounter.
5. Same activation retry is idempotent.
6. Unrelated ClinicalForm/CarePlan/reminder cannot activate Episode.
7. One ACTIVE episode is reused.
8. More than one ACTIVE episode → deterministic conflict.
9. `REOPEN_EXISTING` without non-empty `reopenReason` is rejected; successful reopen preserves lifecycle audit + activation audit.
10. Two concurrent activation attempts → max one ACTIVE.
11. Close ↔ Initial activation race → never two ACTIVE.
12. Close ↔ Return race preserved.
13. DB partial unique index rejects a second ACTIVE episode even outside normal helper.
14. Episode close cancels only authoritative linked OPEN tasks.
15. Historical unlinked tasks are not heuristically cancelled.
16. Close ↔ task complete race is atomic.
17. Close ↔ task reschedule race is atomic.
18. Repeated close cannot duplicate dispositions.
19. Tenant isolation is preserved.
20. Explicit Encounter start/end lifecycle is enforced and audited.
21. Handover creates a machine-linkable `assignmentHistoryId` in the `ENCOUNTER_CLINICIAN_HANDOVER` AuditEvent; latest handover is resolved by `AuditEvent.seq`, not timestamp/free-text ordering.
22. LOST_TO_FOLLOW_UP requires a non-empty reason and is never triggered by overdue alone.
23. DOCTOR and NURSE can perform contact-attempt / lost-to-follow-up; RECEPTIONIST is rejected (403); all other Package R clinical mutation endpoints remain DOCTOR-only unless separately authorized.
24. NURSE cannot access generic `GET /care-tasks`, `complete`, `reschedule`, or `cancel`; class-level DOCTOR-only remains unaffected by method-level override on the two new NR-01 mutation endpoints.
25. Acceptance bound to an older `ClinicianAssignmentHistory.id` (via stale `assignmentHistoryId`) cannot satisfy a later handover; `end` requires acceptance of the exact latest handover assignment resolved by `AuditEvent.seq`; repeated acceptance of the exact latest handover is idempotent.
26. Contact attempts are append-only.
27. Legacy rows are not backfilled/reinterpreted.

---

## 14. Mandatory independent audit

After implementation + ChatGPT direct review:

Fresh Codex focused audit is mandatory for:

- migration safety;
- partial unique index;
- D20-02 activation/domain linkage;
- single-active invariant;
- transaction isolation;
- idempotency;
- Close ↔ Initial activation;
- Close ↔ Return;
- D20-03 task disposition;
- concurrent complete/reschedule/cancel;
- tenant isolation;
- historical-data non-rewrite.

Mandatory question:

> Can closing an Episode concurrently with an Initial Encounter satisfying a valid D20-02 treatment activation create two ACTIVE hemorrhoid CareEpisodes, temporarily or permanently?

If not proven safe by source + tests → audit cannot PASS.

---

## 15. Execution sequence

```text
R0 source/baseline verify
→ R1 migration/schema
→ R2 Treatment Decision v3 + Structured Treatment Activation
→ R3 D20-03 close/task concurrency
→ R4 Encounter start/end + handover acceptance
→ R5 Lost to Follow-up
→ R6 minimal frontend integration
→ R7 backend/frontend targeted regression
→ R8 ChatGPT direct source review
→ R9 Fresh Codex focused audit
→ R10 Owner synthetic acceptance / closure decision

```

No implementation begins until:

1. this Contract is Owner Locked;
2. exact write set is approved;
3. execution baseline is verified clean;
4. Owner explicitly authorizes implementation.

---

## 16. STOP conditions

STOP and return to Owner if:

- source differs materially from this impact analysis;
- activation cannot be machine-linked without heuristic;
- migration precheck finds >1 ACTIVE hemorrhoid Episode for a patient;
- implementation requires broad Prescription/pharmacy subsystem;
- handover requires a new authority decision not covered here;
- real-patient data is encountered;
- Package B/C scope is required to make Package R core invariant work.