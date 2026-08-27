# GASTROCARE — HEMORRHOID VERTICAL SLICE 3 IMPLEMENTATION CONTRACT v0.1

Loại tài liệu: Implementation Contract
Phiên bản: 0.1
Trạng thái: OWNER LOCKED
Ngày: 2026-08-27

Work package:
HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 3 / CONTINUOUS CARE LOOP

Current branch:
discovery/hemorrhoid-real-world-workflow

Discovery / Contract baseline:
42910a46f606315169cdaaf9433b20bfe71b1201

Clinical SSOT:
docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md

Owner Decision:
DEC-013 — OWNER LOCKED

Real-patient runtime:
NOT AUTHORIZED

Implementation/test data:
SYNTHETIC DATA ONLY

--------------------------------------------------
A. OBJECTIVE
--------------------------------------------------

Continuous-care loop:

Initial Encounter
→ HEMORRHOID_EXAMINATION
→ HEMORRHOID_DIAGNOSIS
→ HEMORRHOID_TREATMENT_DECISION
→ CarePlan
→ generic Follow-up CareTask
→ Return Encounter
→ HEMORRHOID_FOLLOW_UP_ASSESSMENT
→ HEMORRHOID_NEXT_CLINICAL_DECISION
→ new CarePlan when needed
→ next follow-up
→ repeat
→ explicit CareEpisode close

Out of scope:

Procedure
generic Surgery
Investigation
CORE-05
AI
production
real-patient runtime

--------------------------------------------------
B. INITIAL ENCOUNTER
--------------------------------------------------

Initial Hemorrhoid Encounter remains permanently ungrouped:

episodeId = null

Do NOT:
- PATCH episodeId later
- backfill episodeId
- introduce a general Encounter PATCH capability

--------------------------------------------------
C. HEMORRHOID CARE EPISODE
--------------------------------------------------

Add episode type:

HEMORRHOID_TREATMENT

CareEpisode starts only when the FIRST Return Encounter is created.

Resolve ACTIVE episode by:

tenantId
+ patientId
+ episodeType = HEMORRHOID_TREATMENT
+ status = ACTIVE

Rules:

0 ACTIVE → create
1 ACTIVE → reuse
>1 ACTIVE → 409 Conflict

Initial Encounter remains ungrouped forever.

--------------------------------------------------
D. FOLLOW-UP ASSESSMENT
--------------------------------------------------

New template:

HEMORRHOID_FOLLOW_UP_ASSESSMENT
version 1

Field:

responseSummary
type = textarea
required = true

No:
- IMPROVED/STABLE/WORSE taxonomy
- scores
- inference
- AI

--------------------------------------------------
E. NEXT CLINICAL DECISION
--------------------------------------------------

New template:

HEMORRHOID_NEXT_CLINICAL_DECISION
version 1

Field:

decisionSummary
type = textarea
required = true

Do NOT reuse HEMORRHOID_TREATMENT_DECISION on Return Encounter.

--------------------------------------------------
F. CAREPLAN ON RETURN ENCOUNTER
--------------------------------------------------

A new clinical decision at a new Return Encounter may create a NEW CarePlan
anchored to that Return Encounter.

Do NOT amend an older Encounter's CarePlan merely to represent a new
clinical occurrence.

CarePlan amendment remains correction/reconciliation of that CarePlan only.

--------------------------------------------------
G. TWO BACKEND-AUTHORITATIVE CAREPLAN SEQUENCES
--------------------------------------------------

Initial branch:

HEMORRHOID_EXAMINATION COMPLETED
→ HEMORRHOID_DIAGNOSIS COMPLETED
→ HEMORRHOID_TREATMENT_DECISION COMPLETED
→ CarePlan
→ SIGNED

Continuous-care branch:

HEMORRHOID_FOLLOW_UP_ASSESSMENT COMPLETED
→ HEMORRHOID_NEXT_CLINICAL_DECISION COMPLETED
→ CarePlan
→ SIGNED

The existing CarePlan prerequisite must NOT silently no-op for Return
Encounters.

Both CarePlan create and sign must enforce the correct branch.

--------------------------------------------------
H. DEDICATED RETURN ENCOUNTER ENDPOINT
--------------------------------------------------

Route:

POST /encounters/hemorrhoid-return

DOCTOR-only.

Request:

careTaskId               required UUID
occurredAt               required ISO8601
reasonForVisit           required
responsibleClinicianId   optional
roomId                   optional

Client MUST NOT supply:

patientId
episodeId
clinicalNote
assessment

patientId is derived from CareTask.
episodeId is resolved by backend.

--------------------------------------------------
I. CARETASK ELIGIBILITY
--------------------------------------------------

Selected CareTask must be:

same tenant
status = OPEN
type = FOLLOW_UP
carePlanId != null
timepointCode = null

Source CarePlan/Encounter must belong to either:

initial Hemorrhoid branch
OR
continuous-care Hemorrhoid branch

Longo/unrelated Core tasks must be rejected.

--------------------------------------------------
J. ATOMIC RETURN ENCOUNTER TRANSACTION
--------------------------------------------------

Use Prisma interactive transaction:

isolationLevel = Serializable

Flow:

BEGIN SERIALIZABLE

1. authoritative load CareTask
2. verify OPEN/generic/Hemorrhoid eligibility
3. derive patientId
4. query ACTIVE HEMORRHOID_TREATMENT episodes
5. >1 → 409
6. 0 → create CareEpisode; 1 → reuse
7. create Return Encounter with episodeId AT CREATION
8. create ClinicianAssignmentHistory
9. guarded CareTask OPEN → COMPLETED transition
10. set completedAt
11. set completedByEncounterId
12. required AuditEvents
13. COMMIT

Guarded CareTask transition must require:

id = careTaskId
AND
status = OPEN

affected rows must equal 1.

Otherwise:
409 Conflict.

Do NOT use the current generic CareTasksService.complete() as the atomic
implementation for this dedicated path.

No automatic retry.

When creating the first episode:

startedAt = Return Encounter.occurredAt

When reusing an episode:
do not change startedAt.

--------------------------------------------------
K. CONCURRENCY
--------------------------------------------------

Expected:

NO PRISMA SCHEMA CHANGE
NO DATABASE MIGRATION

Use:

Serializable transaction
+ authoritative reads
+ controlled Hemorrhoid episode creation path

Serialization/write conflict:

rollback → 409

No automatic clinical retry.

If correctness requires schema/migration:
STOP + Owner Decision.

--------------------------------------------------
L. DIRECT CAREEPISODE CREATION
--------------------------------------------------

HEMORRHOID_TREATMENT must be added to CARE_EPISODE_TYPES.

However generic:

POST /care-episodes

must NOT become an uncontrolled path that can create duplicate ACTIVE
Hemorrhoid episodes.

Preserve existing Longo behavior.

--------------------------------------------------
M. REOPEN
--------------------------------------------------

Reopening HEMORRHOID_TREATMENT must never produce:

>1 ACTIVE HEMORRHOID_TREATMENT
for same tenant + patient

If another ACTIVE same-type episode exists:
409 Conflict.

Reopen must be concurrency-safe.

--------------------------------------------------
N. FOLLOW-UP ASSESSMENT ANCESTRY
--------------------------------------------------

HEMORRHOID_FOLLOW_UP_ASSESSMENT may only exist on Encounter belonging to:

same tenant
same patient
episodeType = HEMORRHOID_TREATMENT
status = ACTIVE

Do not allow it on initial ungrouped Encounter.

--------------------------------------------------
O. NEXT DECISION SEQUENCE
--------------------------------------------------

HEMORRHOID_NEXT_CLINICAL_DECISION requires:

COMPLETED HEMORRHOID_FOLLOW_UP_ASSESSMENT

on the SAME Encounter.

Violation → 409.

--------------------------------------------------
P. CONTINUOUS LOOP
--------------------------------------------------

Return Encounter #N
→ Assessment
→ Next Clinical Decision
→ optional CarePlan #N
→ optional follow-up CareTask
→ next Return Encounter

Reuse the same ACTIVE HEMORRHOID_TREATMENT episode until explicit close.

--------------------------------------------------
Q. CLOSE
--------------------------------------------------

Doctor explicit close only.

No auto-close.

A HEMORRHOID_TREATMENT episode may close only if at least one COMPLETED:

HEMORRHOID_FOLLOW_UP_ASSESSMENT

exists on an Encounter belonging to the episode.

Close must NOT automatically:

cancel CareTasks
rewrite Encounter
rewrite CarePlan
rewrite completed forms

--------------------------------------------------
R. CLOSE VS RETURN RACE
--------------------------------------------------

Concurrent:

CareEpisode close
vs
new Return Encounter

must never commit a new Return Encounter into an episode that was
concurrently closed.

At most one conflicting intent commits.

Loser → 409.

No last-write-wins.

--------------------------------------------------
S. CARETASK MODEL
--------------------------------------------------

Do NOT add episodeId to CareTask.

--------------------------------------------------
T. AUDIT
--------------------------------------------------

Atomic Return flow audit must be transactionally consistent.

Applicable audit events include:

CARE_EPISODE_STARTED
ENCOUNTER_CREATED
CARE_TASK_COMPLETED

Optional:

HEMORRHOID_RETURN_ENCOUNTER_CREATED

only if useful and non-duplicative.

Audit metadata may contain operational IDs only.

Do NOT place clinical free text in AuditEvent metadata:

responseSummary
decisionSummary
CarePlan.instructions

--------------------------------------------------
U. TIMELINE
--------------------------------------------------

Timeline remains read projection.

No Timeline table.

Preserve:

episode grouping
ungrouped initial Encounter
revision/amendment lineage
historical records

Add summary projection:

HEMORRHOID_FOLLOW_UP_ASSESSMENT
→ responseSummary

HEMORRHOID_NEXT_CLINICAL_DECISION
→ decisionSummary

--------------------------------------------------
V. RBAC
--------------------------------------------------

DOCTOR-only:

Return Encounter orchestration
Follow-up Assessment write
Next Clinical Decision write
CarePlan clinical actions
Hemorrhoid CareEpisode close/reopen

Do not expand Receptionist clinical permissions.

--------------------------------------------------
W. T4 CONCURRENCY TESTS
--------------------------------------------------

Real PostgreSQL disposable synthetic DB.

C1 same CareTask double-submit:
- one commit
- one Return Encounter
- one completed CareTask
- one completedByEncounterId
- loser 409

C2 concurrent first returns / same patient:
- never commit two ACTIVE HEMORRHOID_TREATMENT episodes

C3 close vs Return:
- no new Return Encounter committed into concurrently CLOSED episode

C4 rollback:
failure after episode creation but before completion leaves:
- no orphan new episode
- no Return Encounter
- no ClinicianAssignmentHistory
- CareTask OPEN
- no partial AuditEvents

--------------------------------------------------
X. TASK SEQUENCE
--------------------------------------------------

T0 — Governance activation
T1 — Templates + ancestry/sequence
T2 — Atomic Return Encounter orchestration
T3 — two-branch CarePlan enforcement + continuous loop
T4 — episode lifecycle/concurrency + PostgreSQL C1-C4
T5 — Timeline/backend integration
T6 — Frontend
T7 — targeted synthetic acceptance

T4 mandatory focused gate:

implementation + tests
→ ChatGPT source review once
→ fresh Independent Codex READ-ONLY audit once

No repeated audit if T4 production code does not change afterward.

--------------------------------------------------
Y. STOP CONDITIONS
--------------------------------------------------

STOP if implementation requires:

Prisma schema change
database migration
general Encounter PATCH
episodeId backfill
CareTask.episodeId
new clinical taxonomy
IMPROVED/STABLE/WORSE semantics
automatic clinical inference
heuristic task matching
automatic clinical retry
Procedure/Surgery/Investigation
CORE-05
AI
production/real patient data

--------------------------------------------------
Z. REPORT CONTRACT
--------------------------------------------------

Claude reports only:

STATUS
BASELINE
FILES CHANGED
TESTS
FINDINGS
BLOCKERS
GIT STATUS
NEXT GATE

No commit/push without separate Owner authorization.
