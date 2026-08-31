# GASTROCARE — DEC-020 MASTER EXECUTION MAP
## A → B → C dependency and gate map

**Phiên bản:** v0.2\
**Ngày:** 2026-08-31\
**Authority:** `DEC-020 v0.2 — OWNER LOCKED` + Package B Owner Lock / implementation authority and subsequent Owner execution-governance overlay (2026-08-31), recorded separately in `DECISION_LOG.md`\
**Reference baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504` on `correction/owner-acceptance-slice1-3`\
**Purpose:** execution coordination only; this map does not supersede DEC-020 or any locked Package Contract.


**Nguồn artifact:** `DEC-020_MASTER_EXECUTION_MAP_v0.2.md` — bản v0.2 do Owner cung cấp;
SHA-256 nguồn: `70eea52490b37154131b4b1ff5ac86fff1e6f15450069dcdf380e0a8d6822ba1`.
B-GOV chỉ cập nhật trạng thái/gate/baseline theo Owner authority mới; giữ dependency
A → B → C và package scope. Canonical Package B Contract:
[`DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md`](DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md).

---

# 1. Current authority state

```text
DEC-019
→ OWNER CLOSED
→ durable checkpoint: a2059ff6ea2796eee0a798d754b95e70221d2504

DEC-020 v0.2
→ OWNER LOCKED

Package A Contract v0.2
→ OWNER LOCKED; semantics unchanged
Package A
→ OWNER CLOSED
→ A_CLOSED_SHA = 0c865a26c4425a1c3fe429bb8e42238562025801
→ executed FIRST; Package B prerequisite SATISFIED

Post-A governance checkpoint (verified pre-B-GOV HEAD)
→ cdc4f2321f7176fd3c50023d7dd17676c0cd92f6
→ correction/owner-acceptance-slice1-3; pre-write CLEAN
→ A_CLOSED_SHA ancestor; post-A delta governance/docs only

Package B / Contract v0.2
→ EXTERNAL PRE-LOCK REVIEW COMPLETED — PASS; material blockers NONE
→ OWNER LOCKED — 2026-08-31
→ T0→T12 implementation OWNER AUTHORIZED subject to T0 and STOP conditions
→ implementation NOT YET STARTED
→ waiting for clean B-GOV checkpoint; B_GOV_SHA NOT YET ASSIGNED
→ executes SECOND; next implementation gate = Package B T0
→ no clinical/product or T0→T12 substantive implementation requirement changed
→ execution-baseline governance subsequently changed by explicit Owner overlay (§4)
→ original external review remains valid; no second pre-lock review required

Package C Contract v0.1
→ DRAFT / DISCOVERY-DEPENDENT; NOT ACTIVE
→ technical representation intentionally open
→ NOT IMPLEMENTATION-AUTHORIZED; C0 NOT OPENED
→ future dependency: A + B closure and C0 Owner decisions
→ executes THIRD only after applicable Owner authority
```

---

# 2. Why execution is sequential

```text
A = lifecycle truth
B = clinical capture + current-state UX
C = performed-treatment / Investigation architecture
```

Dependency:

```text
A fixes:
Encounter → CareEpisode lifecycle
Return / recurrence
close / reopen

        ↓

B consumes that lifecycle to render:
Patient Dashboard
Clinical View
Examination / Diagnosis / Treatment / Follow-up

        ↓

C consumes the stable Encounter/CareEpisode/Pathway model to decide:
0..N actual procedures
plan vs actual
Investigation gaps
migration/cardinality
```

No mega-batch A+B+C.

Contracts may be prepared/reviewed in advance, but implementation deltas remain separate.

---

# 3. Gate map

| Stage | Entry gate | Executor | Required review/audit | Exit gate |
|---|---|---|---|---|
| A0 Source verify | A Contract OWNER LOCKED + clean baseline | Claude Code | source evidence | T0 CLOSED (historical) |
| A Implementation | A0 CLOSED | Claude Code | targeted tests | COMPLETED (historical) |
| A Review | implementation complete | ChatGPT | direct source review | T10 PASS (historical) |
| A Audit | ChatGPT review complete | Fresh Codex session | focused concurrency/lifecycle audit | initial FAIL → correction → re-audit PASS — NO P0/P1; residual P2 deferred (see Package A closure record) |
| A Closure | evidence complete | Owner | closure decision | OWNER CLOSED at `A_CLOSED_SHA` |
| B Pre-lock | reviewed B v0.2 artifact | Claude Chat/Owner | external review COMPLETED — PASS; material blockers NONE | gate SATISFIED; no second review required |
| B Owner Lock | Package A prerequisite SATISFIED + external review PASS | Owner | explicit decision 2026-08-31 | B v0.2 OWNER LOCKED; T0→T12 OWNER AUTHORIZED |
| B-GOV | clean verified post-A governance checkpoint | governance executor → ChatGPT → Owner | direct governance diff review; Owner decision | separately authorized governance commit/push → clean `B_GOV_SHA` (pending) |
| B Implementation | B OWNER LOCKED + T0→T12 OWNER AUTHORIZED + clean `B_GOV_SHA` under newer Owner overlay; all §4 T0 checks / STOP conditions | Claude Code | targeted tests | NOT YET STARTED; T0 then T1→T12 implementation report |
| B Review | implementation complete | ChatGPT | direct source review | technical findings closed |
| B Clinical Acceptance | B review complete | Owner + BS Thái | browser/workflow acceptance | acceptance evidence for Owner closure; NOT YET EXECUTED |
| B Closure | review + acceptance evidence complete | Owner | explicit Package B closure decision | separately authorized clean `B_CLOSED_SHA` |
| C0 Discovery | future gate after A+B CLOSED and applicable Owner authority; NOT OPENED | Claude Code/read-only discovery or ChatGPT where source accessible | source evidence | Owner decision packet ≤5 questions |
| C Representation | C0 complete | Owner | choose technical representation | executable Contract C revision |
| C Pre-lock | final C Contract | Claude Chat/Owner | exactly one external review | Contract ready |
| C Implementation | C OWNER LOCKED + explicit Owner implementation authority (NOT granted) | Claude Code | tests | implementation report |
| C Review/Audit | implementation complete | ChatGPT + Codex when high-risk | schema/migration/cardinality focused audit | findings closed |
| C Closure | evidence complete | Owner | acceptance | DEC-020 implementation scope closed |

---

# 4. Baseline discipline

Every package starts from a clean durable checkpoint.

## HISTORICAL REVIEWED v0.2 RULE

Original reviewed Master Execution Map v0.2 stated:

> B execution baseline MUST be rebound to `A_CLOSED_SHA`.

Original reviewed Package B Contract v0.2 stated:

> TO BE REBOUND to the clean Package A closure/checkpoint SHA before implementation

These statements remain historical reviewed authority. Neither reviewed rule
originally specified `B_GOV_SHA`.

## NEWER OWNER EXECUTION-GOVERNANCE OVERLAY — 2026-08-31

Owner subsequently **APPROVES** a clean durable governance-only descendant of
`A_CLOSED_SHA` as actual Package B execution baseline. This **SUPERSEDES ONLY**
the literal `A_CLOSED_SHA` execution-checkpoint mechanic. Clinical/product and
T0→T12 substantive implementation requirements, A→B→C scope, STOP conditions,
privacy/safety and testing/review/acceptance requirements remain unchanged.
Original external review remains historically valid; B is already OWNER LOCKED;
no second pre-lock review is required for this execution-governance-only overlay.

The intended descendant is future `B_GOV_SHA`. It does not exist until the
separately Owner-authorized governance commit exists; **NOT YET ASSIGNED**.
`A_CLOSED_SHA` remains immutable Package A closure truth and is not replaced or
relabelled. `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6` is the verified pre-B-GOV
post-A governance reconciliation checkpoint, not Package B execution baseline.
Current dirty B-GOV is governance preparation only.

**T0 must verify all six conditions before implementation:**

1. `A_CLOSED_SHA` is an ancestor of actual HEAD / intended `B_GOV_SHA`.
2. Entire `A_CLOSED_SHA..HEAD` / `A_CLOSED_SHA..B_GOV_SHA` delta is governance/docs only.
3. No unexplained application/backend/frontend/schema/migration/test/tooling delta
   exists in that ancestry range; all non-governance delta fails condition 2.
4. Working tree is **CLEAN**.
5. Branch is Owner-authorized: `correction/owner-acceptance-slice1-3`.
6. Actual verified HEAD is recorded as **`PACKAGE_B_BASE_SHA`**.

Failure blocks execution under the existing baseline STOP condition. These are
future T0 requirements, not a T0 PASS claim or a new audit/tooling/process gate.

**Operative chain under the newer overlay:**

```text
DEC-019 checkpoint
a2059ff6ea2796eee0a798d754b95e70221d2504
        ↓
Package A work
        ↓
A_CLOSED_SHA = 0c865a26c4425a1c3fe429bb8e42238562025801
        ↓
Post-A governance checkpoint = cdc4f2321f7176fd3c50023d7dd17676c0cd92f6
        ↓
B-GOV governance landing → ChatGPT review → Owner decision
        ↓
Separately Owner-authorized governance commit/push
        ↓
Clean B_GOV_SHA (NOT YET ASSIGNED)
        ↓
T0 verifies ancestry + governance/docs-only delta + CLEAN tree + authorized branch
        ↓
PACKAGE_B_BASE_SHA = actual verified HEAD
        ↓
Package B T1→T12 work → review → acceptance → Owner closure
        ↓
B_CLOSED_SHA
        ↓
Package C work
        ↓
C_CLOSED_SHA
```

Rules:

- do not start B implementation on `a2059ff6ea2796eee0a798d754b95e70221d2504` after A has changed semantics;
- Reviewed v0.2 used literal `A_CLOSED_SHA`; the newer overlay above changes only execution-checkpoint mechanics; `A_CLOSED_SHA` remains the immutable prerequisite;
- Operative future B execution baseline is clean durable `B_GOV_SHA` allowed by the newer overlay, after governance diff review and separately Owner-authorized commit/push; do not invent that SHA;
- T0 must satisfy all six overlay checks above before recording actual HEAD as `PACKAGE_B_BASE_SHA`; current `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6` is pre-B-GOV, not `B_GOV_SHA`;
- C execution baseline MUST be rebound to `B_CLOSED_SHA`;
- no package inherits an unexplained dirty tree;
- commit/push/merge/tag remain separately Owner-controlled.

---

# 5. No-scope-change during active gate

Before Package A execution starts, B/C drafts and review preparation may be completed.

Once an implementation/acceptance gate starts:

```text
do not open new tooling/process/scope inside that active gate
```

If a later-package issue is discovered:

```text
record it
→ defer to that package
→ do not contaminate current package
```

Only a genuine blocker that makes the current locked semantics impossible may stop the active package.

---

# 6. Package boundaries

## Package A — Workflow Semantic Reconciliation

Owns:

```text
Initial Encounter episodeId=null
first Return creates/resolves CareEpisode
subsequent Return reuses
recurrence reopen-vs-new explicit
close warning vs hard prerequisite
concurrency / lifecycle
responsible clinician wording drift
synthetic reconciliation
```

Does NOT own Examination v2 / Dashboard / Procedure model.

## Package B — Clinical Form Fidelity + Functional UX

Owns:

```text
Hemorrhoid Examination v2
form fidelity
vital copy-forward UX
Diagnosis presentation
Treatment factual presentation
Investigation factual presentation
Patient Dashboard
Clinical View
History/Timeline navigation
Doctor amendment/finalize UX
```

Does NOT own CareEpisode semantic redesign or performed-procedure schema.

## Package C — Procedure / Investigation Evolution

Owns after discovery:

```text
0..N actual procedures per Encounter
performed-treatment truth
plan vs accepted vs actual representation gaps
procedure/surgery occurrence
Investigation missing states/review/versioning
schema/cardinality/migration if Owner approved
```

Does NOT expand into HIS, generic EMR, laboratory platform or AI.

---

# 7. Audit ownership

```text
Package A
→ Codex focused audit MANDATORY
  because lifecycle + transaction + concurrency

Package B
→ Codex NOT mandatory by default
→ Owner + BS Thái clinical/browser acceptance is the key external gate
→ Codex only if Prisma/schema migration, transaction/concurrency invariant,
  or high-risk authorization/data-integrity delta unexpectedly requires verification

Package C
→ Codex focused audit MANDATORY if schema/migration/cardinality/concurrency changes
```

No repeated audit loop if the single required pass closes without material change.

---

# 8. Report contract for all implementation agents

Exactly:

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

No reasoning diary, no log dump, no self-certification as independent verification.

---

# 9. Global safety boundaries through A/B/C

Remain in force:

```text
SYNTHETIC DATA ONLY
real-patient runtime NOT AUTHORIZED
production NOT AUTHORIZED
AI clinical reasoning NOT AUTHORIZED
automatic diagnosis NOT AUTHORIZED
automatic abnormal interpretation NOT AUTHORIZED
automatic treatment recommendation NOT AUTHORIZED
ICD implementation DEFERRED
legal digital signature NOT AUTHORIZED
```

Clinical truth remains Doctor-controlled.

---

# 10. Immediate execution order

```text
NOW — B-GOV GOVERNANCE LANDING ONLY
│
├─ canonical reviewed Package B Contract v0.2 + Master Execution Map v0.2
├─ reconcile DECISION_LOG / PROJECT_STATE / ROADMAP
├─ preserve Package A closure/history/residual P2 and historical DEC-020 wording
└─ STOP — no Package B T0→T12, no C0, no Git mutation

NEXT
│
├─ ChatGPT direct review of corrected B-GOV diff
├─ Owner decision
├─ Owner separately authorizes one governance-only commit/push
├─ actual resulting commit SHA becomes B_GOV_SHA under the newer Owner overlay
├─ working tree/branch verified clean
├─ Package B T0 — verify all six overlay conditions; record PACKAGE_B_BASE_SHA
├─ Package B T1→T12 — subject to locked Contract / STOP conditions
├─ ChatGPT direct source review
├─ Owner + BS Thái browser/workflow acceptance
├─ Owner Package B closure decision
└─ separately authorized clean B_CLOSED_SHA

FUTURE — AFTER B CLOSE, ONLY WITH APPLICABLE OWNER AUTHORITY
│
├─ rebind C to B_CLOSED_SHA
├─ C0 source discovery (NOT OPENED in B-GOV)
├─ Owner resolves ≤5 technical decisions
├─ finalize/review/lock C
└─ implement C only after explicit Owner authorization
```

**Current gate:** B-GOV; implementation NOT YET STARTED.
**Next gate:** ChatGPT direct review of corrected B-GOV diff → Owner decision → Owner separately authorizes one governance-only commit/push → actual resulting commit SHA becomes `B_GOV_SHA` → working tree/branch verified clean → Package B T0.
