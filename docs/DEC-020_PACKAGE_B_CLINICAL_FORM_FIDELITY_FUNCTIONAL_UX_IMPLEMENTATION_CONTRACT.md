# GASTROCARE — DEC-020 PACKAGE B IMPLEMENTATION CONTRACT
## Clinical Form Fidelity + Functional Clinical UX

**Loại tài liệu:** Implementation Contract (hợp đồng triển khai)\
**Phiên bản:** v0.2 — OWNER LOCKED\
**Ngày:** 2026-08-31\
**Trạng thái:** `OWNER LOCKED — T0→T12 IMPLEMENTATION OWNER AUTHORIZED — IMPLEMENTATION NOT YET STARTED`\
**Authority:** Package B Owner Lock / implementation authority + subsequent explicit `OWNER EXECUTION-GOVERNANCE OVERLAY — 2026-08-31`, recorded separately in `DECISION_LOG.md`; DEC-020 v0.2 remains OWNER LOCKED\
**Work package:** `Package B — Hemorrhoid Clinical Fidelity + Functional Clinical UX`\
**Reference baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504` on `correction/owner-acceptance-slice1-3`\
**Reviewed v0.2 execution-baseline rule (HISTORICAL):** `TO BE REBOUND to the clean Package A closure/checkpoint SHA before implementation`\
**Current execution baseline (NEWER OWNER OVERLAY):** future clean governance-only descendant `B_GOV_SHA`, subject to the overlay and T0 checks below; SHA NOT YET ASSIGNED\
**Data boundary:** `SYNTHETIC DATA ONLY`\
**Real-patient runtime:** `NOT AUTHORIZED`\
**Production:** `NOT AUTHORIZED`\
**AI clinical reasoning:** `NOT AUTHORIZED`\
**Git commit / push / merge / tag:** `NOT AUTHORIZED unless Owner explicitly authorizes`


**Nguồn artifact:** `DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_CONTRACT_DRAFT_v0.2.md` — bản v0.2 đã review do Owner cung cấp; SHA-256 nguồn: `cb234ceaa8dae38da9633991a7135b32d3fbe78f9643c0afbf9e418d16b338b4`.

**Governance landing — 2026-08-31:** External pre-lock review **COMPLETED — PASS**;
material blockers **NONE**; Package B / Contract v0.2 **OWNER LOCKED**;
T0→T12 **OWNER AUTHORIZED**, subject to Contract T0 blocking verification and STOP
conditions. No clinical/product or T0→T12 substantive implementation requirement
changed at Owner Lock. A later explicit Owner execution-governance decision
changes only Package B execution-baseline/checkpoint mechanics (see overlay below).
Implementation **NOT YET STARTED**; B-GOV không thực hiện T0 hoặc T1→T12.

Package A prerequisite **SATISFIED — OWNER CLOSED** tại immutable `A_CLOSED_SHA`
`0c865a26c4425a1c3fe429bb8e42238562025801`. Post-A governance checkpoint đã xác minh:
`cdc4f2321f7176fd3c50023d7dd17676c0cd92f6`; branch
`correction/owner-acceptance-slice1-3`; pre-B-GOV working tree CLEAN;
`A_CLOSED_SHA` là ancestor, post-A delta chỉ gồm governance/docs.
Checkpoint này là baseline của task B-GOV, chưa phải Package B execution baseline.
`B_GOV_SHA` chưa có; chỉ ghi SHA thật sau checkpoint được Owner authorize riêng.
T0 phải xác minh toàn bộ điều kiện overlay bên dưới trước khi ghi actual HEAD
thành `PACKAGE_B_BASE_SHA`; đây chưa phải kết quả Package B T0.

Package C **NOT ACTIVE / DISCOVERY-DEPENDENT / NOT IMPLEMENTATION-AUTHORIZED**;
không mở C0. B-GOV không thay đổi production / real-patient / AI / Git boundaries.

## OWNER EXECUTION-GOVERNANCE OVERLAY — 2026-08-31

**HISTORICAL REVIEWED RULE:** Reviewed v0.2 required
`TO BE REBOUND to the clean Package A closure/checkpoint SHA before implementation`.
Reviewed Master Execution Map v0.2 required B execution baseline to be rebound to
`A_CLOSED_SHA`. Những quy tắc này được giữ nguyên như historical reviewed authority;
reviewed v0.2 **không** quy định `B_GOV_SHA`.

**NEWER OWNER DECISION:** Owner subsequently **APPROVES** execution from a clean,
durable governance-only descendant of `A_CLOSED_SHA`. Overlay này **SUPERSEDES
ONLY** yêu cầu dùng literal `A_CLOSED_SHA` làm execution checkpoint. Intended
future descendant là `B_GOV_SHA`, chỉ có sau ChatGPT review corrected B-GOV diff
→ Owner authorization riêng → governance-only commit/push → clean working tree
và đúng branch. **`B_GOV_SHA` NOT YET ASSIGNED**; không invent SHA hoặc relabel
`A_CLOSED_SHA` / pre-B-GOV `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6`.

**T0 verification required by this newer overlay (NOT EXECUTED in B-GOV):**

1. `A_CLOSED_SHA` (`0c865a26c4425a1c3fe429bb8e42238562025801`) is an ancestor
   of actual HEAD / intended `B_GOV_SHA`.
2. `A_CLOSED_SHA..HEAD` (`A_CLOSED_SHA..B_GOV_SHA`) contains governance/docs changes only.
3. No unexplained application/backend/frontend/schema/migration/test/tooling delta
   exists in that entire ancestry range; an explained non-governance delta also
   fails the governance/docs-only requirement.
4. Working tree **CLEAN**.
5. Branch is the Owner-authorized Package B branch:
   `correction/owner-acceptance-slice1-3`.
6. T0 records actual verified HEAD as **`PACKAGE_B_BASE_SHA`**.

Failure of any overlay condition blocks execution under the existing baseline
STOP condition. No T0→T12 execution is authorized inside this correction task.

No clinical/product or T0→T12 substantive implementation requirement changed;
execution-baseline governance was subsequently changed by this newer explicit
Owner decision. DEC-020 clinical/product decisions, Package A lifecycle semantics,
Package B scope and STOP conditions, privacy/safety and Package C boundaries,
and testing/review/acceptance requirements remain unchanged. Original external
pre-lock review remains historically **COMPLETED — PASS**, Package B remains
**OWNER LOCKED**, and no second external pre-lock review is required: this later
correction changes execution/checkpoint governance only, not those requirements.
It does not imply that the overlay was part of the original external review.
No commit/push/merge/tag authorization is granted by this correction.

---

# 1. Purpose

Package B turns the locked DEC-020 clinical/product semantics into a doctor-usable Hemorrhoid workspace without reopening Package A lifecycle semantics.

Target outcome:

```text
Patient Dashboard = default doctor entry
Clinical View = structured current clinical work
History / Timeline = secondary longitudinal read projection

Hemorrhoid Examination v2
→ faithful to the specialized hemorrhoid source form
→ optional-by-default fields
→ aggregate INTERNAL / EXTERNAL / MIXED morphology
→ deterministic vital copy-forward
→ immutable completion + amendment lineage

Dashboard
→ factual current state
→ no automatic diagnosis
→ no automatic abnormal interpretation
→ no automatic treatment recommendation
```

This package is Functional Clinical UX (UX lâm sàng chức năng), not Full Product Refinement.

---

# 2. Authority and source fidelity

Order of authority:

```text
Newest explicit Owner decision
> DEC-020 v0.2 OWNER LOCKED
> Package A locked/implemented lifecycle semantics
> preserved prior OWNER LOCKED Decisions
> specialized Hemorrhoid form evidence
> VERIFIED current source
> implementation convenience
```

Direct clinical-form evidence:

`BỆNH ÁN NGOẠI KHOA_TRI_Temp-form_v2_31.08.2026.docx`

Direct workflow evidence:

`BỘ CÂU HỎI TRAO ĐỔI VỚI BS THÁI_30.08.2026.docx`

The paper/source form is a clinical evidence/rendering baseline. It is NOT permission to duplicate Patient/Encounter/Facility/Staff administrative data into ClinicalForm responses.

---

# 3. Current-source evidence boundary

Before T0, current-code statements are:

`ASSUMPTION — CHƯA VERIFY trực tiếp tại Package B execution baseline`

External reconciliation evidence reports that the repository already has:

- generic ClinicalFormSubmission/version/amendment infrastructure;
- Hemorrhoid Examination v1 with a smaller subset of form fields;
- Diagnosis free-text chain;
- Treatment Decision v2;
- Investigation/Order/Result capability;
- Case/clinical workspace tabs and Timeline;
- vital copy-forward support.

Package B MUST NOT treat these as `VERIFIED` until T0 directly reads the local source at the post-Package-A baseline.

Every implementation-grounded claim in T0 must use:

`VERIFIED: <path>`

---

# 4. Scope

Package B may modify only what is necessary for:

1. Hemorrhoid Examination v2 fidelity;
2. form-version registration/rendering/validation needed for v2;
3. Doctor Patient Dashboard;
4. Clinical View navigation;
5. factual current-state summaries for Examination / Investigation / Diagnosis / Treatment / Follow-up;
6. previous-vs-current factual comparison where source data already exists;
7. Timeline repositioning under History while preserving it as read-only projection;
8. Doctor confirmation/completion/amendment UX;
9. narrowly related API/resource projection changes required for the UI;
10. targeted tests and synthetic fixtures.

Package B MUST NOT implement:

- CareEpisode lifecycle changes owned by Package A;
- Procedure performed-event representation owned by Package C;
- broad Investigation schema redesign;
- ICD;
- AI clinical reasoning;
- automatic abnormal classification;
- automatic diagnosis/treatment recommendation;
- legal e-signature;
- Full Product Refinement / rebrand / animation;
- real-patient runtime or production.

---

# 5. T0 — Mandatory source verification — BLOCKING

Before any code edit, verify actual execution baseline:

```bash
git branch --show-current
git rev-parse HEAD
git status --short -uall
git diff --check
```

Required:

- Package A is CLOSED/checkpointed according to the Master Execution Map;
- working tree CLEAN;
- branch is the Owner-authorized implementation branch;
- current HEAD is recorded as `PACKAGE_B_BASE_SHA`.

If not: `STOP — REPORT BASELINE MISMATCH`.

Read at least:

```text
AGENTS.md
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
DEC-020 v0.2 OWNER LOCKED
Package A locked Contract + closure report

backend/src/clinical-forms/**
backend/src/clinical-forms/templates/**
backend/src/investigations/**
backend/src/care-plans/**
backend/src/care-tasks/**
backend/src/encounters/**
backend/prisma/schema.prisma

frontend/src/pages/**
frontend/src/components/**
frontend/src/api/**
frontend/e2e/**
relevant frontend/unit tests
```

T0 MUST produce exact evidence for:

A. current Hemorrhoid Examination template keys/versions/field registry;\
B. current generic renderer limits and template-specific validation points;\
C. current vital copy-forward source + deterministic tie-break;\
D. Diagnosis rendering/amendment path;\
E. Treatment Decision rendering and factual status;\
F. Investigation statuses/result/review capability actually present;\
G. CareTask/follow-up projections;\
H. current PatientDetail / DoctorClinicalWorkspace / Case Workspace navigation;\
I. Timeline projection source and read-only behavior;\
J. current amendment/finalization authority;\
K. whether Package B can be implemented without Prisma migration.

No code changes before T0 closes.

---

# 6. T1 — Hemorrhoid Examination v2 field map

Build one explicit v2 field map from the specialized source form.

## 6.1 Administrative fields — DO NOT duplicate blindly

The source form contains:

```text
name / DOB / sex / phone / occupation / ethnicity / nationality / address
insurance/payment identifiers
identity document
relative/contact
arrival time
doctor identity
```

T1 MUST map these to existing Patient / Encounter / Facility / Staff / billing-adjacent domains where already owned.

Package B must not turn these fields into duplicate ClinicalForm truth merely to visually mimic the paper form.

## 6.2 Clinical fields required in v2 structure

At minimum:

### Reason / symptoms

```text
reason / health problem
disease day / unknown when clinically retained
anal pain
anal bleeding
prolapse/lump
other symptom text
```

### History / allergy

```text
drug allergy + manifestation
chemical/cosmetic allergy + manifestation
food allergy + manifestation
constipation history
prior anorectal surgery
respiratory disease
diabetes
cirrhosis
other history
```

### General examination / vitals

```text
pulse
temperature
systolic BP
diastolic BP
respiratory rate
weight
height
SpO2
BMI display/derivation only if existing approved behavior supports it
other general examination text
```

Do not invent a structured hypertension diagnosis from BP values.

### Digital rectal / anorectal examination

```text
stool normal/abnormal + characteristics
palpable tumor yes/no
tumor distance from anal verge in cm when present
Douglas pouch finding
anal sphincter normal/abnormal
other rectal examination
```

### Hemorrhoid morphology — aggregate by type

```text
Goligher grade — one overall examination grade

INTERNAL:
  count
  location
  size

EXTERNAL:
  count
  location
  size

MIXED:
  count
  location
  size

other morphology text
```

No repeatable individual `Pile #1/#2/#3` entity in v1/v2.

Size representation must support clinically entered cm/mm without inventing automatic normalization rules not already authorized.

### Prolapse / bleeding

```text
prolapse — patient reported
prolapse — doctor observed
fibrosis
bleeding — patient reported
bleeding — doctor observed
```

### Other anorectal findings

```text
sphincter tone text
rectal mucosa status
associated anorectal lesion text
skin tag text
other heterogeneous finding text
```

Where BS Thái listed thrombosis/inflammation/ulcer/incarceration/fissure/polyp/fistula/abscess/rectal mucosal prolapse as possible “other” findings, Package B should preserve a usable free-text path unless T0 shows already-approved structured fields.

### Investigation context shown from source form

The source form explicitly references:

```text
CBC / blood cell count
flexible rectoscopy
other
```

Package B must reuse Investigation capability where available; do not create duplicate result truth inside Examination solely to check a paper checkbox.

---

# 7. T2 — Optionality and validation

DEC-020 authority:

```text
Hemorrhoid Examination clinical fields = OPTIONAL by default
```

Therefore:

- DRAFT may be partial;
- COMPLETE must not be blocked merely because an optional source-form field is blank;
- no minimum-field gate to Diagnosis is introduced by this package;
- no hidden “required because UI section exists” behavior;
- template-specific type/range validation is allowed only for data integrity, not clinical completeness.

Do not introduce research-only requirements.

---

# 8. T3 — Vital copy-forward

Preserve the locked behavior:

```text
previous completed eligible visit
→ deterministic prefill
→ Doctor may edit
→ current Encounter saves its own frozen values
```

Requirements:

- unchanged values are still stored in the current Encounter/form snapshot;
- source visit must be deterministic;
- no live reference back to the previous visit after save;
- missing previous value remains missing;
- Doctor can replace the prefilled value;
- Respiratory Rate / SpO2 follow the same source-form fidelity rules if implemented through the same vital mechanism.

T0 determines whether RR/SpO2 belong to existing Encounter vitals or Examination responses. Do not duplicate authoritative truth across both without an explicit reuse strategy.

---

# 9. T4 — Examination UX

The Examination UI must be specialty-oriented and source-form-faithful, not a visible generic form-builder experience.

Target grouping:

```text
1. Lý do khám / triệu chứng
2. Tiền sử / dị ứng
3. Toàn thân / sinh hiệu
4. Thăm trực tràng
5. Đặc điểm búi trĩ
6. Sa / chảy máu
7. Ghi nhận hậu môn-trực tràng khác
8. Cận lâm sàng liên quan
9. Chẩn đoán
10. Kế hoạch điều trị
11. Kết luận / dặn dò
12. Bác sĩ xác nhận / hoàn tất
```

The product may implement sections with existing components/templates; visual resemblance to paper is secondary to clinical meaning and speed of use.

No invented VAS, automatic treatment advice, disease labels or research scales.

---

# 10. T5 — Diagnosis UX

Preserve DEC-020:

```text
1 Encounter
→ 1 logical HEMORRHOID_DIAGNOSIS chain
→ diagnosisSummary textarea
```

Rules:

- doctor may type one or multiple diagnoses in the textarea;
- no PRIMARY/COMORBID/OTHER classification;
- no preliminary/final/post-treatment staging;
- no ICD field in v1;
- amendment is for the whole logical textbox/submission;
- no automatic diagnosis from Goligher or Examination.

Package B should make the Diagnosis state obvious on Dashboard/Clinical View without changing the underlying clinical authority.

---

# 11. T6 — Treatment / conclusion / instructions UX

Display factual separation between:

```text
proposed Treatment Decision
patient accepted/chosen plan when available
actual performed treatment when authoritative data exists
```

Do not label a Pathway/Decision as “performed” unless the underlying current model actually proves performance.

Medical v1:

```text
free-text prescription / medication notes
```

Conclusion/Instructions should have clinically distinct logical presentation where existing primitives allow:

```text
diagnosis/conclusion
treatment plan
prescription
instructions
diet/lifestyle
warning signs
urgent-return guidance
follow-up target
```

Reuse existing domain primitives first. If implementing the separation requires a new persistent entity/model beyond current authority:

`STOP / DEFER — PACKAGE B must not invent schema`.

**External-review expectation note (non-blocking):**

If the current model has no authoritative storage for `patient accepted/chosen plan`, Package B must display that state as `not recorded / unavailable` rather than infer it. The storage decision belongs to Package C discovery/Owner decision.

---

# 12. T7 — Investigation UX

Package B is primarily presentation/reuse for Investigation.

Required factual states:

```text
ordered
in progress
resulted
cancelled
patient declined

result available / not available
doctor reviewed / not reviewed
```

Only show a state if T0 verifies current backend support or a narrowly scoped non-schema extension is explicitly allowed by the locked Contract.

Never display automatic “normal/abnormal” clinical interpretation without later Owner authority.

External provenance, late-result linkage and correction/versioning must be displayed only to the extent current authoritative source supports them.

Any missing core capability is recorded for Package C, not fabricated in B.

**External-review expectation note (non-blocking):**

Current external review evidence suggests some desired Investigation presentation states — especially explicit order status and Doctor-reviewed state — may not yet exist in the current persistence model. T0 must verify this directly. If absent, Package B must render only factual capabilities already supported and defer the missing core capability to Package C rather than add schema here.

---

# 13. T8 — Patient Dashboard

Patient Dashboard becomes the default Doctor landing screen for the patient.

It must answer quickly, using factual existing data:

```text
Who is the patient?
Latest clinical Encounter
Current CareEpisode status
Current Diagnosis text
Current Treatment Decision / Pathway state
Pending Investigations
Available results
Doctor-reviewed status
Open / upcoming follow-up tasks
Latest Examination summary
Relevant explicit workflow actions
```

Dashboard may show:

```text
previous vs current
```

for factual values such as vitals/examination items when data lineage is clear.

Dashboard MUST NOT:

- diagnose;
- score disease automatically;
- classify result abnormality;
- recommend treatment;
- infer recurrence;
- infer episode close;
- infer performed procedure.

When data is unavailable, show unknown/not recorded rather than manufacture a conclusion.

---

# 14. T9 — Clinical View and navigation

Target navigation:

```text
Patient Dashboard        ← default

Clinical View
  ├── Examination
  ├── Investigation
  ├── Diagnosis
  ├── Treatment
  └── Follow-up

History
  └── Timeline
```

Rules:

- Timeline remains read-only historical projection;
- Timeline is not deleted;
- Doctor should not need Timeline to reconstruct basic current state;
- current-state panels must link back to their authoritative record where practical;
- Package A Case/recurrence lifecycle must be reflected, not reimplemented.

---

# 15. T10 — Amendment / finalize UX

Clinical amendment authority remains Doctor-only.

Clinic Admin alone does not gain clinical amendment rights.

Requirements:

- completed ClinicalForm records remain immutable;
- correction creates/uses existing amendment/version lineage;
- Doctor sees current version and access to prior versions/history;
- action language should be `Bác sĩ xác nhận` / `Hoàn tất` / `Sửa có lưu vết` as appropriate;
- do not call this a legal digital signature.

If frontend currently exposes an amendment action to a non-Doctor clinical-ineligible user, correct it within existing authorization semantics; do not invent a new role.

---

# 16. T11 — Backend/API delta policy

Preferred order:

```text
REUSE existing ClinicalForm / Investigation / CareTask / Treatment APIs
> ADD read projection/aggregation endpoint only if clearly needed
> narrow template-specific extension
> STOP before broad schema redesign
```

Package B SHOULD NOT require Prisma migration.

If T0 proves a Prisma/schema migration is necessary for form fidelity or Dashboard:

```text
STOP
→ report exact missing invariant/data ownership
→ Owner decides whether to amend Package B Contract
```

Adding a new ClinicalForm template version/field definitions in code is not by itself a Prisma migration.

---

# 17. T12 — Tests

Minimum backend/template tests:

1. v1 historical Examination remains readable/amendable under its stored version semantics;
2. v2 registers as the latest Examination version;
3. v2 optionality does not block completion solely for blank clinical fields;
4. field types/choices validate correctly;
5. aggregate Internal/External/Mixed morphology round-trips;
6. Goligher remains one overall value;
7. patient-vs-doctor prolapse/bleeding remain distinct;
8. vital copy-forward is deterministic and current snapshot freezes;
9. no auto Diagnosis/Treatment mutation occurs from Examination;
10. Diagnosis remains one logical free-text chain;
11. Doctor-only amendment/finalize authorization preserved.

Minimum frontend tests:

- Patient Dashboard is default clinical patient entry;
- Dashboard factual cards render unknown/not-recorded safely;
- Examination v2 sections and fields render correctly;
- no Pile repeatable UI;
- no ICD/VAS/automatic abnormal/treatment suggestion UI;
- Diagnosis textarea supports multi-line/multiple clinical statements;
- Investigation card uses factual statuses only;
- Timeline remains accessible under History;
- amendment history/current version is visible;
- non-Doctor clinical amendment is unavailable/rejected.

Browser workflow acceptance should cover at least one synthetic patient across:

```text
Initial Encounter
→ Examination v2
→ Diagnosis
→ Treatment Decision
→ Follow-up/Return context
→ Dashboard
→ History
```

Run targeted suites + build/typecheck required by AGENTS/current package. Do not automatically rerun unrelated full browser suites.

---

# 18. Implementation report

Claude Code report exactly:

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

No commit/push/merge/tag without separate Owner authorization.

---

# 19. Review and acceptance

After implementation:

```text
Claude Code implementation + tests
→ ChatGPT direct source review
→ Owner + BS Thái browser/workflow acceptance
```

Codex is NOT mandatory for Package B unless implementation unexpectedly introduces:

- Prisma migration;
- transaction/concurrency invariant;
- high-risk authorization/data-integrity change.

Owner/BS Thái acceptance focus:

1. form fidelity;
2. speed/clarity of doctor workflow;
3. Dashboard answers current-state questions without Timeline reconstruction;
4. no invented clinical reasoning;
5. terminology matches actual practice.

---

# 20. STOP conditions

STOP if:

- Package A has not closed/checkpointed;
- dirty/unrelated baseline;
- source-form fidelity requires duplicating authoritative patient/admin data;
- required feature needs unapproved schema migration;
- a Dashboard card would require clinical inference rather than factual projection;
- Package C Procedure representation becomes necessary;
- Investigation core capability is missing and needs broad redesign;
- privacy/RBAC boundary would weaken;
- real-patient/production data is encountered.

---

# 21. External pre-lock review record

**Status:** `COMPLETED — PASS`\
**Material blockers:** `NONE`

The required external pre-lock review pass has been completed.

Review results:

1. v2 field map fidelity / no administrative SSOT duplication — PASS;
2. optional-by-default clinical fields — PASS;
3. aggregate Internal/External/Mixed morphology — PASS;
4. Diagnosis / ICD / amendment semantics — PASS;
5. factual, non-interpretive Dashboard — PASS;
6. Timeline preserved in secondary History role — PASS;
7. Procedure/Investigation scope containment — PASS;
8. design can proceed without Prisma migration; T0 still blocks and defers if source proves otherwise — PASS.

Non-blocking expectations recorded in v0.2:

- Investigation UX may be intentionally thin if current source lacks explicit order-status / Doctor-reviewed persistence; missing core capability must defer to Package C.
- `patient accepted/chosen plan` must display as not recorded/unavailable if no authoritative storage exists; Package B must not infer it.

These clarifications do not change the locked DEC-020 clinical/product semantics and do not require another external review pass.

**Governance update — Owner directive 2026-08-31:** Package B Owner Lock and
T0→T12 implementation authority are now SATISFIED; Package A closure/checkpoint
prerequisite is SATISFIED. Implementation has NOT YET STARTED and waits for the
governance checkpoint allowed by the subsequent Owner execution-governance overlay
above, not by the original reviewed baseline rule. `A_CLOSED_SHA` remains the
immutable prerequisite and historical reviewed execution checkpoint. Future
`B_GOV_SHA` (not yet assigned) becomes actual Package B execution baseline only
after the separately authorized clean checkpoint and all six overlay T0 checks.
Original pre-lock review remains historically valid; no second pre-lock review
is required for this execution-governance-only correction.

---

# 22. Current status

```text
DEC-020 v0.2
→ OWNER LOCKED; historical wording preserved

Package A Contract v0.2
→ OWNER LOCKED; semantics unchanged
Package A
→ OWNER CLOSED
→ A_CLOSED_SHA = 0c865a26c4425a1c3fe429bb8e42238562025801
→ Package B prerequisite SATISFIED

Package B / Contract v0.2
→ EXTERNAL PRE-LOCK REVIEW COMPLETED — PASS
→ material blockers NONE
→ OWNER LOCKED — 2026-08-31
→ T0→T12 IMPLEMENTATION OWNER AUTHORIZED
→ subject to T0 blocking verification and Contract STOP conditions
→ IMPLEMENTATION NOT YET STARTED
→ later Owner execution-governance overlay permits a clean governance-only descendant
→ waiting for clean B_GOV_SHA and all overlay T0 checks; SHA NOT YET ASSIGNED

Package C
→ NOT ACTIVE / DRAFT / DISCOVERY-DEPENDENT
→ NOT IMPLEMENTATION-AUTHORIZED; C0 NOT OPENED
```

**Current gate:** B-GOV governance landing only, then STOP for review.

**Next gate:** ChatGPT direct review of corrected B-GOV diff → Owner decision → Owner separately authorizes one governance-only commit/push → actual resulting commit SHA becomes `B_GOV_SHA` → working tree/branch verified clean → Package B T0.

Owner authority does not authorize commit/push/merge/tag. The historical DEC-020
statement that Package B was not automatically implementation-authorized remains
valid for that earlier lock; the newer Package B decision grants the later
authority. Review/acceptance after implementation remains governed by §19.
