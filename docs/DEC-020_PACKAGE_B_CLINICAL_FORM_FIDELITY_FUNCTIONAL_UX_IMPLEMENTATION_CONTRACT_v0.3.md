# GASTROCARE — DEC-020 PACKAGE B IMPLEMENTATION CONTRACT
## Clinical Form Fidelity + Functional Clinical UX — v0.3 (Reconciliation)

**Loại tài liệu:** Implementation Contract (hợp đồng triển khai)\
**Phiên bản:** v0.3 — **OWNER LOCKED — 2026-09-17**\
**Ngày:** 2026-09-17\
**Trạng thái:** `OWNER LOCKED — Owner accepted 2026-09-17. Lock này authorize
Package B v0.3 T0 source verification only; KHÔNG authorize implementation,
schema/migration, production, hoặc real-patient runtime.`\
**Authority:** [[DEC-020]] v0.2 OWNER LOCKED (preserved for all PRESERVE scope) +
[[DEC-021]] v0.3 OWNER LOCKED + [[DEC-021]] Package R Implementation Contract
v0.5 FINAL (CLOSED after R9) + [[DEC-022]] OWNER LOCKED (Package B UNBLOCKED) +
[[DEC-023]] OWNER LOCKED (2026-09-17 — Longo sequential follow-up, multi-line
Diagnosis v2, LTFU auto-detect + human confirm, LTFU confirmation RBAC)\
**Work package:** `Package B — Hemorrhoid Clinical Fidelity + Functional Clinical UX (reconciled under DEC-021/DEC-022/DEC-023)`\
**Reconciliation baseline:** `main @ c2a30e4dd5e73730a2f6932def107d3e936fafe8`\
**Reconciliation working branch:** `docs/dec-020-package-b-contract-v03`\
**Future Package B implementation branch:** `TBD — requires separate Owner authorization`\
**Data boundary:** `SYNTHETIC DATA ONLY`\
**Real-patient runtime:** `NOT AUTHORIZED`\
**Production:** `NOT AUTHORIZED`\
**AI clinical reasoning:** `NOT AUTHORIZED`\
**Prisma schema change / migration:** `NOT AUTHORIZED by this Contract / Owner Lock` — any T0
finding that requires one is a STOP condition (see §9)\
**Git commit / push / merge / tag:** `NOT AUTHORIZED unless Owner explicitly authorizes`

---

# 0. Relationship to Contract v0.2

This document does **not** reimplement or restate Package R lifecycle logic. It
inherits v0.2 in full except where [[DEC-021]] or [[DEC-023]] explicitly
supersede a specific rule. Superseded v0.2 rules are annotated additively
in-place in `DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md`
(historical text preserved, not rewritten). This v0.3 describes only:

1. the four delta areas Owner-decided on 2026-09-17 ([[DEC-023]]): Vitals,
   Diagnosis, Longo follow-up, LTFU;
2. the T0 verification each delta area requires before any implementation;
3. what remains OWNER DECISION REQUIRED and therefore BLOCKED.

Everything in v0.2 not touched here (Examination v2 field map, Investigation UX,
Treatment/conclusion UX, Patient Dashboard, Clinical View navigation, amendment/
finalize UX, backend/API delta policy, general STOP conditions) remains in force
unchanged.

---

# 1. Authority order

```text
Newest explicit Owner Decision ([[DEC-023]], 2026-09-17)
> [[DEC-022]] (Package B unblocked)
> [[DEC-021]] v0.3 + Package R Implementation Contract v0.5 FINAL (CLOSED after R9)
> [[DEC-020]] v0.2 OWNER LOCKED (preserved scope)
> current repository source (VERIFIED at reconciliation baseline)
> AI recommendation
```

Where v0.2, DEC-021, and DEC-023 conflict, DEC-023 governs for the specific rule
it names; everything else follows v0.2/DEC-021 unchanged.

---

# 2. Scope of this reconciliation

In scope (delta only):

1. Vitals — remove/retire/repurpose deterministic copy-forward per [[DEC-023]] §1 annotation.
2. Diagnosis — introduce `HEMORRHOID_DIAGNOSIS v2` ordered repeatable free-text lines.
3. Longo follow-up — replace fixed automatic scheduling with sequential, doctor-driven, at-most-one-next-CareTask scheduling for future decisions only.
4. LTFU — extend `CareTaskContactAttempt` for qualifying-failed-attempt counting; add human-confirmed, atomic, transactional LTFU→Episode-close consequence; RBAC delta for final confirmation only.
5. T0 source verification required to ground all four deltas before any implementation.

Out of scope: see §12 Non-goals. Package R lifecycle logic (D20-02, D20-03,
Structured Treatment Activation, NR-03/NR-04/NR-07, Treatment Decision v3) is
**not** reopened or reimplemented by this document.

---

# 3. Codex-confirmed source findings (accepted as-is, not re-litigated)

1. `CareTaskContactAttempt` entity + `CareTask.contactAttempts` relation already
   exist; `CareTasksService.contactAttempt()` already writes this entity. No
   second ContactAttempt entity may be created.
2. `FieldType` currently has `number | text | textarea | single_choice | boolean
   | multi_select`. No repeatable-text / text-array type exists outside
   `multi_select`. Validator requires `text`/`textarea` to be a string; arrays
   exist only for `multi_select`. Multi-line Diagnosis therefore affects the
   form framework/rendering layer, not only a template file.
3. Current LTFU RBAC (DEC-021/current implementation): `DOCTOR + NURSE` on both
   `contact-attempt` and `lost-to-follow-up`; `RECEPTIONIST` has neither. DEC-023
   supersedes this only for final LTFU confirmation authority (see §10.5).
4. A generic `CarePlan.followUpDate → sign CarePlan → CareTask` mechanism
   already exists. This is existing capability for T0 to evaluate; Longo is
   **not** defaulted to reuse it.

---

# 4. T0 — Mandatory source verification — BLOCKING (Package B v0.3 delta scope)

Before any code edit for the four delta areas, T0 must reverify baseline (per
v0.2 §5 procedure, same commands) and then produce `VERIFIED: <path>` evidence
for each of the following. No code changes before this T0 closes.

## 4.1 Vitals

- Every producer/consumer of `getVitalsCopyForward()` (exact file/function paths).
- Every caller path where "current response auto-prefill" or "Apply/Copy" UI
  action currently exists (backend and frontend).
- Whether historical stored values can be rendered read-only without touching
  the write path.
- Recommendation: remove / retire / repurpose read-only — with evidence, not
  assumption. No blind deletion.

## 4.2 Diagnosis

- Template registry / version resolution mechanism (where `HEMORRHOID_DIAGNOSIS`
  version is selected and how a new version would be added).
- `types.ts` field/type definitions relevant to diagnosis and to `FieldType`.
- `validation.ts` rules currently enforcing `text`/`textarea` = string.
- Backend response representation (how `responses` JSON currently stores the
  diagnosis value).
- Frontend domain types consuming diagnosis responses.
- Form renderer behavior for `textarea` vs. a prospective repeatable/array type.
- Create / update / complete / amend flow touchpoints for Diagnosis.
- Historical (v1) submission rendering path — must remain unaffected.
- Existing tests covering Diagnosis behavior.
- Prisma persistence requirements — current `responses` being JSON is evidence
  only; T0 must not conclude "no migration required" before this analysis
  completes, and must not preemptively lock a generic `repeatable_text` type,
  a generic text-array type, or a diagnosis-specific renderer as the answer.
  T0 proposes the minimal option fitting current architecture.

## 4.3 Longo follow-up

- Exact trigger location of the current fixed scheduler (which timepoints it
  creates and from where).
- `TIMEPOINT_OFFSET_DAYS` or equivalent constant/config location.
- Which parts of the current scheduler are retired vs. historical-only
  (`TWO_WEEK`, `MONTH_1`, `MONTH_3`, `MONTH_6` forms/submissions/tasks/data must
  be preserved untouched).
- Whether the existing generic `CarePlan.followUpDate → sign CarePlan →
  CareTask` mechanism is fit for reuse for the new sequential-weekly behavior,
  or whether a narrower mechanism is more appropriate — T0 evaluates, does not
  assume reuse.

## 4.4 LTFU

- Exact current schema/fields on `CareTaskContactAttempt` (what it stores today).
- `contactAttempt()` call path (controller → service → repository/Prisma).
- DTO shape currently accepted/returned.
- Controller RBAC guard(s) currently applied to `contact-attempt` and
  `lost-to-follow-up`.
- Existing audit event(s) emitted, and what would need to be added for the new
  confirm-LTFU consequence chain.
- Timestamp semantics currently recorded on a contact attempt.
- Idempotency behavior of repeated contact-attempt calls.
- Concurrency handling currently in place (if any) for CareTask/Episode state
  transitions.
- Query/index requirements to efficiently count qualifying failed attempts.
- Frontend caller(s) of contact-attempt / lost-to-follow-up, if any exist today.
- Exact machine-checkable path from a CareTask to its authoritatively-linked
  CareEpisode (the join/foreign key actually used).
- Minimal machine-checkable data-model delta to distinguish a "qualifying
  failed" contact attempt from other outcomes (T0 proposes; not implemented
  here).
- Which service/application-command layer is the least architecturally
  disruptive place for the atomic transaction boundary described in §10.7.

---

# 5. Delta 1 — Vitals (locked behavior)

```text
Each Encounter enters its own new vital values.
Historical values MAY display read-only.
Current response entry MUST NOT auto-prefill.
Current response entry MUST NOT populate the current value.
Current response entry MUST NOT expose an Apply/Copy action.
```

T0 (§4.1) determines remove / retire / repurpose-read-only for
`getVitalsCopyForward()` and every caller. No blind deletion — every consumer
must be accounted for before disposition is chosen.

Historical vitals data/submissions are unaffected.

---

# 6. Delta 2 — Diagnosis (locked behavior)

```text
HEMORRHOID_DIAGNOSIS v1  → unchanged, historical semantics, diagnosisSummary NOT edited in place
HEMORRHOID_DIAGNOSIS v2  → ordered list of free-text diagnosis lines
                             line 1 = chẩn đoán chính (required)
                             line 2+ = chẩn đoán kèm (optional)
                             Doctor adds a line via UI action "Thêm dòng"
```

This is a **behavior** lock, not an implementation-shape lock. T0 (§4.2) must
determine the minimal implementation fitting current architecture across
template registry/versioning, `types.ts`, `validation.ts`, backend response
representation, frontend domain types, form renderer, create/update/complete/
amend flows, historical rendering, tests, and Prisma persistence — including
whether a migration is actually required. No option (generic `repeatable_text`,
generic text-array, diagnosis-specific renderer, or other) is pre-selected.

---

# 7. Delta 3 — Longo sequential follow-up (locked behavior)

```text
Current follow-up Encounter
        ↓
Doctor evaluates
        ↓
Need another follow-up?
        ├─ YES → Doctor chooses next date (default ~1 week per prior clinical
        │        decision) → create at most 1 next CareTask
        └─ NO  → create no next CareTask → Doctor may explicitly close Episode
```

Rules:

- No auto-chain; no pre-created future schedule.
- No fixed maximum number of weeks.
- Exactly one Owner-decided default interval reference: ~1 week, chosen by the
  doctor per clinical decision each time — not hard-coded as an automatic
  scheduler default that bypasses doctor choice.
- Supersedes fixed automatic scheduling (`14 ngày / 1 tháng / 3 tháng / 6
  tháng`) for **future scheduling behavior** only.
- Historical `TWO_WEEK` / `MONTH_1` / `MONTH_3` / `MONTH_6` forms, submissions,
  tasks, and data are preserved untouched — no rewrite/delete.
- No new enum/state code (`FOLLOW_UP_REQUIRED`, `NO_FURTHER_FOLLOW_UP`, or
  similar) may be introduced without further SSOT authority; T0 reports what
  representation the current architecture already offers before any such code
  is proposed.
- Reuse of the existing generic `CarePlan.followUpDate → sign CarePlan →
  CareTask` mechanism is a T0 evaluation option, not a default.

---

# 8. Delta 4 — LTFU (locked behavior)

## 8.1 Contact-attempt counting

- Extend existing `CareTaskContactAttempt`; no second ContactAttempt entity.
- No invented contact-channel taxonomy.
- T0 (§4.4) proposes the minimal machine-checkable data-model delta needed to
  mark/derive "qualifying failed attempt." Not implemented in this document.

## 8.2 Confirmation

- Final confirmation authority: `DOCTOR + NURSE + RECEPTIONIST`.
- `contact-attempt` authority unchanged: `DOCTOR + NURSE`.
- Frontend may only show warning/eligibility; frontend is never the authority.
- Backend must independently verify: authoritative contact attempts, threshold,
  actor authority, target CareTask, Episode linkage, and current state. A
  client-sent flag such as `eligible=true` must never be trusted.

## 8.3 Authoritative Episode linkage

- The target Episode must resolve machine-checkably from the CareTask via the
  actual, existing foreign-key/join path — never `patientId` alone, nearest-
  Episode-by-date, temporal proximity, free text, current UI context, or any
  other heuristic.
- If exactly one valid ACTIVE Episode cannot be resolved: `CONFLICT / STOP`. No
  inference, no automatic repair.

## 8.4 Atomic transaction

```text
verify task state
→ verify threshold
→ verify actor authority
→ resolve exact Episode
→ target CareTask → LOST_TO_FOLLOW_UP
→ Episode → CLOSED
→ dispose remaining linked OPEN tasks
→ append required audits
→ commit once
```

- One application transaction boundary; not two independent transactions
  (`markLostToFollowUp()` then `closeEpisode()`) if that ordering could produce
  partial clinical state (e.g., CareTask = `LOST_TO_FOLLOW_UP` while CareEpisode
  = `ACTIVE`).
- Any step failing → `ROLLBACK ALL`.
- T0 must analyze, at minimum, these concurrency scenarios: simultaneous LTFU
  confirmations; a contact attempt concurrent with a confirmation; a normal
  Episode close concurrent with an LTFU confirmation; a CareTask complete/
  cancel/reschedule concurrent with a confirmation.
- No auto-retry of this clinical state-changing transaction unless current
  governance already permits it.

## 8.5 Episode closure semantics

- Normal Episode Close remains a DOCTOR explicit action — unchanged.
- New path added: authorized human-confirmed LTFU → system consequence →
  Episode Close.
- No auto-close from threshold alone; Episode closes only after valid human
  confirmation.

---

# 9. STOP conditions (in addition to v0.2 §20, unchanged)

STOP if:

- T0 finds that any delta requires a Prisma schema change or migration beyond
  what a future, separately Owner-authorized Package B Implementation Contract
  would lock — report exact missing invariant/data ownership; do not implement.
- Exactly one valid ACTIVE Episode cannot be resolved for a CareTask during
  LTFU confirmation (`CONFLICT / STOP`, no inference/repair).
- The atomic LTFU transaction cannot be implemented as a single boundary without
  a schema/architecture change that is not already authorized.
- Diagnosis v2 cannot be implemented without a new `FieldType` / validator /
  persistence change that is not already authorized — report options, do not
  choose unilaterally.
- Any historical CareTask, timepoint code, ClinicalForm submission, template, or
  data would need to be rewritten or deleted to implement any of the four
  deltas.
- Real-patient/production data is encountered.
- Privacy/RBAC boundary would weaken beyond the explicit §10.5-equivalent
  ([[DEC-023]] point 4) narrow LTFU-confirmation supersession.

---

# 10. OWNER DECISION REQUIRED

```text
OWNER DECISION REQUIRED — exact machine-checkable definition of "1 month" for
the LTFU threshold ("3 qualifying failed contact attempts trong 1 tháng").
```

Not resolved by this document. Candidate definitions (rolling 30 days, calendar
month, rolling calendar month, or another arithmetic rule) are NOT chosen here.
T0 may describe the technical consequences of each candidate but must not select
one. **LTFU threshold implementation is BLOCKED until the Owner decides.**

---

# 11. Review and acceptance (inherits v0.2 §19, unchanged)

```text
Claude Code implementation + tests
→ ChatGPT direct source review
→ Owner + BS Thái browser/workflow acceptance
```

LTFU atomic-transaction/concurrency changes remain subject to the project's
existing review/audit governance. This Contract v0.3 does not create a new
mandatory Codex gate. Any independent audit requirement must come from an
applicable OWNER LOCKED governance source or later explicit Owner
authorization.

---

# 12. Non-goals

Not in scope for this reconciliation or its eventual implementation:

- generic low-code form builder;
- generic workflow engine;
- multi-specialty redesign;
- AI clinical reasoning;
- a new/second ContactAttempt subsystem;
- a contact-channel taxonomy;
- pharmacy subsystem;
- Package C;
- full UI/UX redesign;
- R10 acceptance (remains DEFERRED per [[DEC-022]]).

---

# 13. Current status

```text
DEC-020 v0.2            → OWNER LOCKED; historical wording preserved
DEC-021 v0.3            → OWNER LOCKED; Package R CLOSED after R9 (R10 DEFERRED)
DEC-022                 → OWNER LOCKED; Package B UNBLOCKED
DEC-023                 → OWNER LOCKED (2026-09-17); this v0.3 reconciles it

Package B / Contract v0.3 (this document)
→ OWNER LOCKED — 2026-09-17
→ T0 (§4) source verification AUTHORIZED
→ implementation NOT AUTHORIZED
→ T0 (§4) NOT YET EXECUTED
→ "1 month" LTFU threshold definition: OWNER DECISION REQUIRED (§10)
```

**Current gate:** Package B v0.3 T0 source verification — OWNER AUTHORIZED.

**Next gate:** Package B v0.3 T0 source verification
→ Owner review of T0
→ Owner decides the exact "1 month" definition
→ separate Owner authorization for implementation.
No commit/push/merge/tag; no schema/migration; no implementation-complete or
PASS/CLOSED claim may be made from this document.
