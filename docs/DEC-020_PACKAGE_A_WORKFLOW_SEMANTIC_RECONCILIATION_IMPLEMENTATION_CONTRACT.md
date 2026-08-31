# GASTROCARE — DEC-020 PACKAGE A IMPLEMENTATION CONTRACT
## Workflow Semantic Reconciliation

**Loại tài liệu:** Implementation Contract (hợp đồng triển khai)  
**Phiên bản:** v0.2  
**Ngày:** 2026-08-31  
**Trạng thái:** `OWNER LOCKED — 2026-08-31 — T0→T9 IMPLEMENTATION AUTHORIZED SUBJECT TO T0 STOP CONDITIONS`  
**Authority:** `DEC-020 v0.2 — OWNER LOCKED — 2026-08-31`  
**Work package:** `Package A — Workflow Semantic Reconciliation — P0`  
**Intended baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504` on `correction/owner-acceptance-slice1-3`  
**Data boundary:** `SYNTHETIC DATA ONLY`  
**Real-patient runtime:** `NOT AUTHORIZED`  
**Production:** `NOT AUTHORIZED`  
**Git commit / push / merge / tag:** `NOT AUTHORIZED unless Owner explicitly authorizes`  
**External review before Contract lock:** `REQUIRED — exactly one source-aligned Claude Chat or Owner review pass`

---

# 1. Purpose

This Contract converts the locked Package A portion of DEC-020 into an executable, testable work package without reopening the clinical decisions.

Authoritative target:

```text
Initial Hemorrhoid Encounter
→ workflowKind = HEMORRHOID_INITIAL
→ episodeId = null

First-ever Hemorrhoid Return
→ if no prior treatment episode requiring recurrence choice:
   0 ACTIVE → create exactly one ACTIVE HEMORRHOID_TREATMENT
   1 ACTIVE → reuse
   >1 ACTIVE → conflict / STOP

Subsequent Return with ACTIVE episode
→ reuse that ACTIVE episode

Return after prior episode(s) are CLOSED and no ACTIVE episode exists
→ DO NOT silently choose reopen vs new episode
→ Doctor explicitly chooses:
   reopen a specific closed episode
   OR
   start a new treatment episode
```

CareEpisode close:

```text
DOCTOR explicit action only
NEVER automatic
completed HEMORRHOID_FOLLOW_UP_ASSESSMENT = desirable, not required
missing assessment → non-blocking warning
close still allowed after Doctor confirmation
```

Closing the episode must not silently cancel open CareTask/TreatmentPathway records. Open items must remain visible and require explicit disposition.

---

# 2. Authority and non-negotiable semantics

Order of authority:

```text
Newest explicit Owner decision
> DEC-020 v0.2 OWNER LOCKED
> prior Owner Decisions preserved by DEC-020 selective supersession
> VERIFIED current source
> implementation recommendation
```

This Contract MUST NOT change:

- Initial Hemorrhoid Encounter stays outside the CareEpisode;
- first Return begins/resolves the Hemorrhoid treatment episode;
- no heuristic Case inference from text, chronology, form presence, URL or frontend state;
- Doctor-only explicit close;
- no automatic close;
- no hard Follow-up Assessment prerequisite for close;
- Doctor chooses reopen-old vs start-new after closure;
- creator/provenance and responsible clinician remain separate;
- Facility and Room semantics remain unchanged;
- real-patient runtime / production remain unauthorized.

---

# 3. Current-source evidence boundary

Before implementation, all current-code claims are:

`ASSUMPTION — CHƯA VERIFY trực tiếp tại baseline a2059ff6...`

External review/reconciliation evidence reports that:

- DEC-016-era code may currently attach Initial Hemorrhoid Encounter to a Case;
- Return may require/reuse that pre-existing Case;
- close may currently require a completed Follow-up Assessment;
- `TreatmentPathway.caseId` is required;
- Encounter ↔ TreatmentPathway linkage may require matching non-null Case ancestry.

These are NOT treated as self-verified facts by this Contract.

T0 MUST turn every relevant claim into exact:

`VERIFIED: <path>`

or record that the expected implementation is different.

---

# 4. Scope

Package A may modify only what is needed for:

1. Hemorrhoid Initial Encounter Case-membership semantics;
2. Hemorrhoid Return Encounter CareEpisode resolution;
3. recurrence choice when prior episode(s) are closed;
4. CareEpisode close prerequisite/warning behavior;
5. reopen/new-episode explicit lifecycle behavior;
6. narrowly related timeline/projection/API/UI behavior needed to keep the workflow coherent;
7. responsible-clinician UI wording/comment reconciliation if source verification confirms current copy is inaccurate;
8. deterministic synthetic-data reconciliation required by the semantic change;
9. targeted regression/concurrency tests for the above.

Package A does NOT implement:

- Hemorrhoid Examination v2;
- Patient Dashboard redesign;
- ProcedureOccurrence or new performed-procedure model;
- broad Investigation changes;
- ICD;
- AI/automatic clinical reasoning;
- Product Refinement;
- real-patient/production behavior.

---

# 5. Schema / TreatmentPathway boundary

T0 MUST inspect:

```text
backend/prisma/schema.prisma
backend/src/treatment-pathways/
relevant migration SQL
Encounter relations
```

and answer with source evidence:

```text
Can an Initial Encounter with episodeId=null safely exist
while TreatmentPathway remains Case-scoped?
```

Default Package A policy:

```text
PRESERVE existing TreatmentPathway Case requirement
DEFER structured TreatmentPathway attachment until a CareEpisode exists
```

Package A does NOT authorize a new Procedure entity or broad cardinality redesign.

If implementing D20-02 correctly requires relaxing `TreatmentPathway.caseId`, changing composite ancestry, or another schema/cardinality redesign:

```text
STOP
→ report blocker
→ do not improvise migration/schema semantics
→ Owner decides whether to amend Contract A or defer to Package C
```

A narrowly scoped data-only reconciliation migration/script for SYNTHETIC data is permitted only if T0 proves it necessary, deterministic, non-fabricating and compatible with existing schema invariants.

No historical clinical data may be invented.

---

# 6. T0 — Mandatory local source verification — BLOCKING

Before any code edit:

```bash
git branch --show-current
git rev-parse HEAD
git status --short -uall
git diff --check
```

Expected start:

```text
branch = correction/owner-acceptance-slice1-3
HEAD   = a2059ff6ea2796eee0a798d754b95e70221d2504
working tree = CLEAN
```

If baseline differs or unrelated dirty files exist:

`STOP — REPORT BASELINE MISMATCH`

Read at least:

```text
AGENTS.md
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
locked DEC-020 v0.2

backend/prisma/schema.prisma
backend/src/care-episodes/**
backend/src/encounters/**
backend/src/treatment-pathways/**
backend/src/care-plans/**
backend/src/care-tasks/** or current follow-up task module
backend/src/clinical-forms/**
backend/src/patients/**
relevant migrations

frontend/src/api/**
frontend/src/pages/**
relevant CareEpisode/Return/close/reopen components and tests
```

T0 report MUST provide exact evidence for:

A. current Initial Hemorrhoid Encounter creation behavior;  
B. current Return Encounter Case resolution;  
C. active Case uniqueness/conflict mechanism;  
D. transaction isolation and concurrency strategy;  
E. current close prerequisite;  
F. current reopen/new episode APIs;  
G. open CareTask/TreatmentPathway close side effects, if any;  
H. TreatmentPathway ↔ Case/Encounter constraint;  
I. responsible-clinician resolution and frontend wording;  
J. synthetic rows/fixtures affected by the semantic change.

Every evidence claim must use:

`VERIFIED: <path>`

No code changes before T0 closes.

---

# 7. T1 — Implementation plan after T0

After T0, produce a concise delta plan mapping each DEC-020 requirement to current source.

The plan must choose the smallest safe implementation.

Required classifications:

```text
REUSE
MODIFY
ADD
DEFER
STOP
```

If T0 shows the locked semantics can be implemented without schema/cardinality changes, proceed.

If a new schema/cardinality design is required beyond the narrow data-reconciliation permission in §5, STOP.

---

# 8. T2 — Initial Encounter reconciliation

Target invariant:

```text
new HEMORRHOID_INITIAL Encounter
→ episodeId = null
```

Requirements:

- no automatic Case create/reuse from Initial Encounter;
- no retrospective re-parenting merely for query convenience;
- preserve `workflowKind`;
- preserve explicit `occurredAt`;
- preserve Facility/Room/responsible clinician/provenance behavior;
- preserve Examination/Diagnosis/Treatment Decision/CarePlan on the Initial Encounter where already supported;
- no TreatmentPathway attachment to the Initial Encounter if current schema requires Case and Contract has not authorized schema relaxation.

Add targeted tests proving Initial Encounter remains Case-less.

---

# 9. T3 — Return Encounter and recurrence reconciliation

## First-ever Return / active episode resolution

Required behavior:

```text
0 ACTIVE and no recurrence-choice situation
→ create exactly one ACTIVE HEMORRHOID_TREATMENT
→ Return belongs to it

1 ACTIVE
→ reuse

>1 ACTIVE
→ deterministic conflict / STOP
```

Creation/resolution plus Return creation and linked CareTask completion must preserve existing atomicity/concurrency safeguards.

## Return after CLOSED history

When:

```text
0 ACTIVE
AND
one or more relevant CLOSED HEMORRHOID_TREATMENT episodes exist
```

the system must not silently infer whether to reopen or start new.

Required explicit Doctor choice:

```text
REOPEN_EXISTING <closedEpisodeId>
or
START_NEW
```

If current API cannot represent that choice safely:

- add the narrowest explicit API/DTO/UI control required;
- do not infer from chronology;
- do not automatically reopen “latest”;
- do not automatically start new merely because active count is zero.

Concurrency tests must cover simultaneous creation/reopen attempts sufficiently to protect the single-active-episode invariant.

---

# 10. T4 — Close behavior reconciliation

Backend target:

```text
Doctor explicit close
→ permitted whether or not completed HEMORRHOID_FOLLOW_UP_ASSESSMENT exists
```

Missing assessment must not cause a hard backend rejection solely for that reason.

Frontend target:

```text
assessment missing
→ clear non-blocking warning
→ Doctor explicitly confirms
→ close proceeds
```

Preserve:

- Doctor authorization;
- actor/timestamp/audit;
- tenant/patient ownership checks;
- concurrency protection;
- no inferred close reason;
- no automatic close.

Open CareTask/TreatmentPathway:

- must not be silently auto-cancelled solely by CareEpisode close;
- must be surfaced before/at close using existing projections where feasible;
- if exact explicit disposition cannot be safely added inside Package A without opening Package C scope, preserve them unchanged and show the factual open-item warning.

No automatic clinical recommendation text.

---

# 11. T5 — Reopen / start-new behavior

Preserve explicit audited reopen.

Verify current reopen requirements from source; do not invent request fields.

Reuse-first requirement:

- T0 MUST verify whether the existing Reopen endpoint/API can be reused directly for `REOPEN_EXISTING`.
- If it can, implementation MUST reuse that existing path rather than create a parallel reopen mechanism.
- A new reopen API/DTO is allowed only if T0 proves the existing capability cannot safely represent the locked DEC-020 semantics.

Required semantic:

- Doctor chooses;
- selected closed episode is explicit;
- no active duplicate;
- audit preserved;
- concurrent reopen/start-new cannot produce multiple ACTIVE Hemorrhoid treatment episodes.

Starting a new post-closure episode must also be explicit when closed history exists.

---

# 12. T6 — Responsible clinician wording reconciliation

This is UI/copy only unless T0 proves a real backend defect.

T0 must first verify the actual resolution semantics.

If current backend is:

```text
Doctor omits responsibleClinicianId → authenticated Doctor
Receptionist omits responsibleClinicianId → configured pilot default
```

then frontend/help text/comments must say that accurately.

Do not change authorization or selection semantics merely to match old copy.

---

# 13. T7 — Synthetic-data reconciliation

Inventory affected synthetic data:

- Initial Hemorrhoid Encounters currently attached to Case;
- Return Encounters;
- CareTasks completed by Return;
- TreatmentPathways linked through Initial Encounter, if any;
- ClinicalFormSubmissions;
- audit/history rows;
- test fixtures.

Rules:

- no mapping by free text or chronology alone;
- no fabricated clinical history;
- use explicit deterministic fixture/manifest identifiers;
- preserve immutable audit meaning;
- if ambiguity exists, STOP rather than guess.

Preferred order:

```text
fixture/replay reconciliation
> deterministic synthetic data script
> additive data migration only when necessary
```

Do not rewrite old migration files.

---

# 14. T8 — Tests

Minimum targeted backend tests:

1. Initial HEMORRHOID_INITIAL Encounter remains `episodeId=null`;
2. first-ever Return with 0 active creates exactly one episode;
3. Return with 1 active reuses it;
4. `>1 active` is rejected/conflicted;
5. simultaneous first-Return attempts do not create two ACTIVE episodes;
6. post-closure Return requires explicit reopen-vs-new choice;
7. simultaneous reopen/start-new attempts preserve single-active invariant;
8. close succeeds with completed assessment;
9. close also succeeds without assessment after explicit Doctor confirmation/path;
10. non-Doctor close rejected;
11. close does not silently cancel open CareTask/TreatmentPathway;
12. tenant/patient isolation preserved;
13. Return ↔ CareTask atomic completion preserved where applicable.

Minimum frontend tests:

- Initial creation copy/flow does not imply Case creation;
- recurrence choice shown when required;
- close warning without assessment is non-blocking;
- responsible-clinician wording matches verified backend semantics.

Regression:

Run the smallest existing relevant Hemorrhoid/Case/Return/close/reopen suites plus build/typecheck required by AGENTS/affected package.

Do not rerun unrelated full-project browser suites unless the implementation touches their shared infrastructure or a relevant regression fails.

---

# 15. T9 — Implementation report

Claude Code final report format exactly:

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

Do not claim independent verification.

Do not commit/push/merge/tag unless separately authorized by Owner.

---

# 16. T10 — ChatGPT source review

After implementation:

ChatGPT reviews the actual changed source/diff directly where accessible and checks it against DEC-020 + this Contract.

Review focus:

- initial Case-less invariant;
- Return resolution;
- recurrence explicit choice;
- close warning vs hard prerequisite;
- CareTask/Pathway side effects;
- concurrency;
- tenant/auth/audit;
- no Package B/C scope leakage.

This review is not the independent audit.

---

# 17. T11 — Focused Codex independent audit

Because Package A changes lifecycle/concurrency semantics, one fresh independent Codex session is mandatory after implementation + ChatGPT review.

Audit scope is delta-focused:

```text
transaction/concurrency
single-active invariant
initial/return Case ancestry
reopen/new episode race
close authorization and side effects
synthetic reconciliation
migration safety if any
```

Do not repeat a broad full-project audit unless a blocker requires it.

Codex session must be different from the implementation session.

---

# 18. Acceptance / close criteria

Package A can close only when:

- DEC-020 semantics are implemented for Package A scope;
- targeted tests pass;
- no unresolved P0/P1 finding remains;
- ChatGPT source review completes;
- focused independent Codex audit completes;
- Owner decides closure/acceptance according to the then-current gate.

Package A closure does NOT imply Package B/C acceptance.

---

# 19. STOP conditions

STOP immediately if:

- baseline mismatch or unrelated dirty work;
- source contradicts a locked DEC-020 semantic in a way that needs a new Owner decision;
- implementation requires broad TreatmentPathway schema/cardinality redesign;
- synthetic data cannot be reconciled deterministically without fabrication;
- concurrency invariant cannot be preserved;
- tenant/RBAC/privacy boundary would be weakened;
- real patient/production data is encountered;
- Package B/C scope becomes necessary to make A work.

Report the blocker; do not improvise.

---

# 20. External pre-lock review record

**Status:** `COMPLETED — PASS WITH NON-BLOCKING CLARIFICATION`  
**Material blockers:** `NONE`

The required external source-aligned review pass has been completed against the available repository/Decision evidence.

Review result:

1. first-ever Return vs recurrence-after-close distinction — PASS;
2. transaction/concurrency preservation — PASS;
3. TreatmentPathway Case-dependence handling — PASS;
4. deterministic synthetic reconciliation boundary — PASS;
5. close-without-assessment as warning, not automatic close — PASS;
6. open CareTask/Pathway side-effect boundary — PASS;
7. Package B/C scope containment — PASS;
8. targeted test scope — PASS.

Non-blocking clarification incorporated into v0.2:

- §11 now explicitly requires reuse-first verification of the existing Reopen endpoint before any new reopen API/DTO is considered.

Documented review limitation:

- reviewer could not directly fetch local baseline `a2059ff6ea2796eee0a798d754b95e70221d2504` from the remote repository;
- therefore T0 local source verification remains mandatory and blocking before implementation;
- this limitation does not change the Contract's substantive semantics.

Because v0.2 only adds a reuse-first clarification and records the completed review, no additional external review pass is required before Owner Lock.

Implementation remains prohibited until Owner explicitly locks this Contract.

---

# 21. Owner Lock record

**Owner decision:** `OWNER LOCK Package A Contract v0.2`  
**Lock date:** `2026-08-31`  
**Locked baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504`  
**Documented baseline-review limitation:** `EXPLICITLY ACCEPTED BY OWNER`

```text
DEC-020 v0.2
→ OWNER LOCKED

Package A Contract v0.2
→ EXTERNAL PRE-LOCK REVIEW COMPLETED
→ OWNER LOCKED
→ T0→T9 IMPLEMENTATION AUTHORIZED
→ T0 remains BLOCKING
→ STOP conditions remain mandatory
→ T10 ChatGPT source review follows implementation
→ T11 fresh Codex focused independent audit follows T10
```

This Owner Lock does not authorize commit / push / merge / tag. Those remain separately Owner-controlled.

**Next executable gate:** `T0 → T9 in one continuous Claude Code implementation session`, provided T0 passes.
