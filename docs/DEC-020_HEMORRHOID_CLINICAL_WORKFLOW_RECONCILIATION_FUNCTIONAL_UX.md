# GASTROCARE — DEC-020
## Hemorrhoid Clinical Workflow Reconciliation & Functional Clinical UX

**Loại tài liệu:** Owner Decision (quyết định Owner)  
**Phiên bản:** v0.2  
**Ngày:** 2026-08-31  
**Trạng thái:** `OWNER LOCKED — 2026-08-31 — PACKAGE A CONTRACT v0.2 OWNER LOCKED — T0→T9 IMPLEMENTATION AUTHORIZED SUBJECT TO T0 STOP CONDITIONS`  
**Repository:** `/home/blockchain/projects/gastrocare`  
**Baseline branch:** `correction/owner-acceptance-slice1-3`  
**Baseline SHA:** `a2059ff6ea2796eee0a798d754b95e70221d2504`  
**Previous work package:** `DEC-019 — OWNER CLOSED`  
**Implementation/test data:** `SYNTHETIC DATA ONLY`  
**Real-patient runtime:** `NOT AUTHORIZED`  
**Production:** `NOT AUTHORIZED`  
**AI clinical reasoning:** `DEFERRED / NOT AUTHORIZED`  
**Commit / push / merge / tag:** `NOT AUTHORIZED unless Owner explicitly authorizes`

---

# 1. Mục đích

DEC-020 reconcile (đối soát) GastroCare với workflow bệnh trĩ thực tế đã được Owner và BS Thái xác nhận sau các Vertical Slice / DEC trước đó, đồng thời mở một phạm vi **Functional Clinical UX (UX lâm sàng chức năng)** có giới hạn trong Clinical Core.

DEC-020 có ba mục tiêu:

1. sửa các clinical semantics (ngữ nghĩa lâm sàng) hiện không còn phù hợp với quyết định Owner mới nhất, đặc biệt là thời điểm hình thành `CareEpisode`;
2. nâng Hemorrhoid Examination và Doctor Workspace từ biểu diễn kỹ thuật/generic thành workflow bám form chuyên khoa thực tế;
3. giữ nguyên nguyên tắc manual-first clinical truth (sự thật lâm sàng do bác sĩ xác nhận), không mở automatic diagnosis, automatic interpretation, automatic recommendation hoặc AI clinical reasoning.

DEC-020 không tự cấp quyền implementation. Implementation chỉ được mở sau:
- một external pre-lock review pass (lượt phản biện ngoài trước khi khóa);
- Owner xác nhận `OWNER LOCKED`;
- Implementation Contract riêng cho package tương ứng được khóa.

---

# 2. Authority (thứ bậc thẩm quyền)

Khi có xung đột:

```text
Newest explicit Owner decision
> DEC-020 sau khi OWNER LOCKED
> prior OWNER LOCKED Decisions còn hiệu lực
> clinical/source-form evidence
> current implementation
> historical UI drafts / implementation notes
```

`AGENTS.md` của repository luôn thắng nếu có xung đột về repository governance, Git, security, privacy hoặc execution protocol.

DEC-020 sử dụng selective supersession (thay thế có chọn lọc), không blanket-supersede toàn bộ DEC-010→DEC-019.

---

# 3. Source basis (nguồn căn cứ)

Clinical/product evidence dùng để dựng DRAFT này:

- `BỘ CÂU HỎI TRAO ĐỔI VỚI BS THÁI_30.08.2026.docx`;
- `BỆNH ÁN NGOẠI KHOA_TRI_Temp-form_v2_31.08.2026.docx`;
- Hemorrhoid workflow/ClinicalForm Decisions DEC-010, DEC-012, DEC-013;
- DEC-015 workflow discriminator;
- DEC-016 Case / Investigation / TreatmentPathway architecture;
- DEC-018 admin boundary;
- DEC-019 staff/credential boundary;
- newest explicit Owner decisions captured during DEC-020 preparation.

Important evidence rule:

> Source forms are evidence and rendering baseline; they are NOT permission to duplicate every administrative field into `ClinicalFormSubmission` or to turn GastroCare into a generic HIS/EMR.

---

# 4. Code-evidence boundary

**ASSUMPTION — CHƯA VERIFY trực tiếp trên source tại baseline `a2059ff6...`:**

External local reconciliation reported that the current implementation still carries DEC-016 Case-origin semantics in which Initial Hemorrhoid Encounter creates/reuses Case and Return requires that Case, and that close currently has a harder Follow-up Assessment prerequisite.

DEC-020 does NOT self-certify those current code facts as `VERIFIED`.

Before Package A writes production code, T0 of its Implementation Contract MUST directly inspect at least:

```text
backend/src/care-episodes/
backend/src/encounters/
backend/src/clinical-forms/templates/hemorrhoid-continuous-care*
backend/src/patients/
frontend/src/pages/
frontend/src/api/
```

and then record exact `VERIFIED: <path>` evidence.

The Owner decisions below remain authoritative even if exact current implementation details differ.

---

# 5. D20-01 — Encounter lifecycle (vòng đời lượt khám)

## Decision

A Hemorrhoid Encounter begins when the receptionist or doctor explicitly creates the visit/examination record.

At creation:

```text
Patient
+ Facility
+ Room/Location when applicable
+ responsible clinician
+ explicit occurredAt
→ Encounter created
```

Rules:

1. Receptionist or Doctor may create the Encounter according to existing authorization.
2. `occurredAt` is explicit clinical occurrence time entered/confirmed at creation; do not substitute `createdAt`.
3. Encounter completion/finalization is a Doctor decision.
4. Creator/provenance actor and responsible clinician remain separate concepts.
5. Existing clinician handover semantics remain explicit and audited.
6. Facility and Room remain separate physical-context levels.
7. No CareEpisode may be inferred from reason text, form presence, URL, frontend state or chronology.

---

# 6. D20-02 — Hemorrhoid CareEpisode starts at first Return Encounter

## Decision

For the Hemorrhoid workflow:

```text
Initial Hemorrhoid Encounter
→ workflowKind = HEMORRHOID_INITIAL
→ episodeId = null
```

The Initial Encounter remains outside a `HEMORRHOID_TREATMENT` CareEpisode.

The Hemorrhoid CareEpisode begins at the first actual Return Encounter.

Authoritative resolution:

```text
First / subsequent Return Encounter

0 matching ACTIVE HEMORRHOID_TREATMENT
→ create exactly one ACTIVE CareEpisode
→ create Return Encounter inside it

1 matching ACTIVE HEMORRHOID_TREATMENT
→ reuse it

>1 matching ACTIVE HEMORRHOID_TREATMENT
→ conflict / STOP
→ never choose heuristically
```

Rules:

1. Initial Examination, Diagnosis, Treatment Decision and initial CarePlan may live on the ungrouped Initial Encounter.
2. The first Return Encounter creates/resolves the treatment/follow-up CareEpisode.
3. Subsequent Return Encounters reuse the same active CareEpisode unless an explicit clinical lifecycle decision changes it.
4. The Initial Encounter is not retrospectively attached to the CareEpisode merely to simplify queries.
5. CareTask / CarePlan lineage may reference the relationship between the Initial Encounter and later Return workflow, but CareTask must not become an accidental Case-provenance mechanism.
6. No new `CareCase` table or rename is decided by this DEC.
7. Existing synthetic data reconciliation strategy (migration vs fixture/replay reset) is Implementation Contract A scope; no fabricated clinical history is permitted.
8. **ASSUMPTION — CHƯA VERIFY trực tiếp tại baseline `a2059ff6...`:** external pre-lock review reports that current `TreatmentPathway.caseId` is required and its Encounter linkage depends on matching `Encounter.episodeId`. Therefore an Initial Encounter with `episodeId=null` may not be able to attach a structured `TreatmentPathway`. Contract A MUST verify the exact schema/source and explicitly choose one of: preserve the constraint and defer structured pathway/method tracking until a Case exists; narrowly relax the schema/linkage if separately justified and authorized; or stop with a blocker if neither option is safe. DEC-020 does **not** decide that technical representation here.

### Selective supersession

This decision:

- **RE-AFFIRMS** the earlier semantic that the Initial Hemorrhoid Encounter remains ungrouped and the treatment episode starts at first Return;
- **SUPERSEDES** the DEC-016 rule stating that the Initial Hemorrhoid Encounter has a Case immediately and Return only reuses that Case;
- **SUPERSEDES** any future-write rule requiring Case creation at Initial Encounter;
- **SUPERSEDES** any rule that automatically re-parents a new Initial Encounter into the Hemorrhoid Case.

It does NOT require removal of `TreatmentPathway`, `Investigation`, or other DEC-016 capabilities.

---

# 7. D20-03 — CareEpisode close and recurrence

## Close

CareEpisode close is:

```text
DOCTOR explicit action only
NEVER automatic
```

The doctor decides from the Patient Dashboard / clinical record whether the treatment episode should end.

A completed `HEMORRHOID_FOLLOW_UP_ASSESSMENT` is:

```text
DESIRABLE
but
NOT A HARD PREREQUISITE
```

If no completed assessment exists:

```text
show non-blocking warning
→ doctor may still explicitly confirm close
```

Required:

- actor;
- timestamp;
- audit event;
- no automatic clinical reason inference;
- no silent lifecycle transition.

## Recurrence / patient returns after closure

The system MUST NOT decide automatically whether a recurrence:

```text
reopens the old episode
or
starts a new episode
```

The Doctor reviews the patient and explicitly chooses.

Reopen remains an explicit audited action. Exact request fields and concurrency implementation are Contract A scope.

## Recommended lifecycle side-effect rule for Owner acceptance with this DEC

Closing a CareEpisode SHOULD NOT automatically cancel open `CareTask` or `TreatmentPathway` records merely because the Case/Episode is closed.

Instead:

```text
surface open items
→ require explicit disposition
→ preserve audit
```

If Owner locks DEC-020 without changing this paragraph, this becomes the target behavior for Contract A.

---

# 8. D20-04 — Diagnosis v1: one logical chain, free text may contain multiple diagnoses

## Decision

Preserve:

```text
1 Encounter
→ exactly 1 logical HEMORRHOID_DIAGNOSIS chain
```

The authoritative v1 content remains one free-text field:

```text
diagnosisSummary
```

Clarification:

- the Doctor may enter one or multiple diagnoses in that textbox;
- no `PRIMARY / COMORBID / OTHER` role classification in v1;
- no preliminary/final/post-treatment diagnosis stages;
- amendment lineage is for the whole textbox/submission, not individual diagnosis lines;
- Doctor is the clinical authority;
- GastroCare must not auto-diagnose from Examination, Goligher, symptoms, Investigation, rule engine or AI.

## ICD

```text
ICD-10 / coding = DEFERRED
```

V1 must not implement ICD fields now.

Architecture should not make future coding impossible, but no code system, K64/I84 mapping or automatic coding is clinical truth in this package.

### Supersession effect

DEC-012 single logical Diagnosis chain is **PRESERVED**.

DEC-020 only clarifies that one free-text chain may contain multiple diagnoses.

---

# 9. D20-05 — Clinical amendment authority

Clinical content mutation/amendment requires Doctor clinical authority.

```text
Clinic Admin alone
≠ clinical authority
```

An account that is Clinic Admin may modify clinical content only when that same authenticated account also satisfies the Doctor clinical authorization required for that action.

Rules:

- do not create a new “clinical admin” role solely for this;
- admin capability and clinical authority remain separate;
- Nurse/Receptionist operational capabilities must not be silently promoted into Doctor amendment authority;
- completed clinical records remain immutable; correction uses amendment/version lineage.

---

# 10. D20-06 — Hemorrhoid Examination v2 fidelity

`BỆNH ÁN NGOẠI KHOA_TRI_Temp-form_v2_31.08.2026.docx` is the direct specialty-form evidence baseline for Hemorrhoid Examination v2.

The product must reproduce the clinical meaning and usable structure of that form without blindly duplicating administrative data already owned by Patient/Encounter/Facility/Staff domains.

## Required clinical sections

At minimum Clinical View must cover the source-form structure:

```text
Lý do khám / vấn đề sức khỏe
Hỏi bệnh
  ├── triệu chứng
  ├── tiền sử
  └── dị ứng
Khám lâm sàng
  ├── sinh hiệu / toàn thân
  ├── thăm trực tràng
  ├── đặc điểm búi trĩ
  ├── sa / chảy máu
  └── tổn thương hậu môn-trực tràng khác
Cận lâm sàng / investigation context
Chẩn đoán
Kế hoạch điều trị
Kết luận / dặn dò
Bác sĩ xác nhận / hoàn tất
```

## Field optionality

For the current Hemorrhoid Examination:

```text
all clinical fields remain OPTIONAL by default
```

The system must not block progression merely because a source-form field is empty unless a later explicit Owner/clinician decision makes it required.

## Morphology

V1 clinical representation is aggregate by hemorrhoid type, NOT repeated individual pile objects.

```text
INTERNAL
  count
  location
  size

EXTERNAL
  count
  location
  size

MIXED
  count
  location
  size
```

Rules:

- Internal / External / Mixed remain separate;
- count/location/size are recorded per type;
- no `Pile #1 / Pile #2 / Pile #3` repeatable entity in v1;
- size supports clinical cm/mm representation;
- one overall Goligher grade for the patient/examination;
- prolapse and bleeding remain separate;
- patient-reported vs doctor-observed values may remain distinct where source form distinguishes them;
- additional heterogeneous anorectal findings remain available as free text where appropriate.

## Vital copy-forward

Preserve:

```text
previous completed visit
→ deterministic prefill
→ Doctor edits if needed
→ current Encounter saves its own frozen snapshot
```

If the value is unchanged, the current Encounter still stores the current snapshot.

## Form fidelity prohibitions

Do not invent fields merely because a mockup contained them.

In particular, do not add to general Hemorrhoid Examination solely from UI imagination:

- invented VAS;
- invented structured hypertension;
- automatic derived disease labels;
- automatic treatment suggestions;
- research-only fields in routine workflow.

---

# 11. D20-07 — Investigation clinical boundary

Preserve existing Investigation capability where available; DEC-020 does not recreate Investigation from scratch.

Clinical rules:

1. Order status must support factual workflow states including ordered/in progress/resulted/cancelled/patient declined.
2. A late result remains attached to the correct patient and clinical occurrence.
3. External result provenance should retain source/facility/date/recorder/original-source metadata where capability is authorized.
4. Wrong result correction requires Doctor clinical authority, reason and version/history preservation.
5. Product must show factual state:
   - result available/not available;
   - doctor reviewed/not reviewed.
6. Product must NOT automatically label a result “normal/abnormal” unless a later explicitly approved clinical interpretation rule exists.
7. Raw result and Doctor interpretation/Diagnosis are distinct clinical concepts.

Exact schema/API/UI extensions beyond current capability are Package C scope.

---

# 12. D20-08 — Treatment truth

A Treatment Decision is not proof that treatment was actually performed.

Required conceptual separation:

```text
Doctor proposed plan
Patient accepted/chosen plan
Actual treatment performed
```

These must not be silently collapsed.

Multiple modalities may coexist or change over the same treatment course:

```text
MEDICAL
PROCEDURE
SURGERY
```

A newer clinical decision may supersede/modify an earlier plan while preserving history.

## Medical Treatment v1

Use the current simple clinical requirement:

```text
free-text prescription / medication notes / instructions
```

Do not open a full Prescription Workflow in this package.

## Surgery

Surgery occurs in hospital context.

For the current specialty scope:

```text
LONGO
OTHER (Doctor free text / explicitly selected other method)
```

Longo may be a UI default for the BS Thái workflow only if the clinician still explicitly confirms it.

Backend must never silently persist Longo merely because it was preselected in UI.

Do not conflate:

```text
LONGO
with
STARR
```

No legal/electronic-signature claim is introduced by “Bác sĩ xác nhận/Hoàn tất”.

---

# 13. D20-09 — Procedure clinical multiplicity

Clinical truth:

```text
one Encounter
→ 0..N actual procedures
```

A procedure may be performed during the same Encounter when clinically appropriate.

Initial supported procedure vocabulary from clinician evidence includes:

```text
Sclerotherapy / tiêm xơ
Rubber-band ligation / thắt vòng cao su
RFA / infrared coagulation as currently defined by the specialty form
```

Actual performance must be distinguishable from a proposed Treatment Decision.

## Technical representation intentionally NOT locked here

DEC-020 does NOT decide yet whether `0..N actual procedures per Encounter` is implemented by:

```text
existing TreatmentPathway reuse
cardinality extension
ProcedureOccurrence
another reviewed reuse-first representation
```

Package C must inspect current source and perform reuse-first impact analysis before proposing schema changes.

No new Procedure entity is authorized merely by this Decision.

---

# 14. D20-10 — Follow-up and branch-aware care

Follow-up is a first-class clinical workflow.

Doctor controls:

```text
create
edit/reschedule
cancel
```

A follow-up task may be completed by:

```text
linked Return Encounter
or
explicit authorized manual completion
```

Follow-up behavior may differ by treatment branch:

```text
MEDICAL
PROCEDURE
SURGERY
```

Do not silently apply Longo fixed timepoints to generic Hemorrhoid follow-up.

Existing explicit CareTask ↔ Return Encounter linkage, audit and concurrency safeguards are preserved unless a later Contract explicitly changes them.

No heuristic matching from diagnosis text/reason text is authorized.

---

# 15. D20-11 — Conclusion & Instructions separation

The product should keep clinically distinct information as distinct logical sections, even when the source paper form visually groups them.

At minimum:

```text
Diagnosis / conclusion
Treatment plan / treatment
Prescription / medication text
Instructions
Diet / lifestyle
Warning signs
When to return urgently
Follow-up target
```

Implementation must reuse existing domain primitives first.

DEC-020 does not automatically authorize a new table/entity for each section.

---

# 16. D20-12 — Functional Clinical UX is authorized inside Clinical Core

Functional Clinical UX is now in scope.

Full Product Refinement remains deferred.

## Default Doctor entry: Patient Dashboard

The primary clinical screen should answer quickly:

```text
Patient current state
Current diagnosis
Current treatment / pathway
Pending investigations
Results available
Doctor-reviewed status
Follow-up / open tasks
Current CareEpisode status
Latest visit
Relevant next actions
```

The Dashboard may show factual comparison:

```text
previous
vs
current
```

but must not perform unapproved clinical interpretation.

## Navigation

Target clinical navigation:

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

Timeline remains an immutable/read-only projection and moves to a secondary History role; it is not deleted.

## UX goal

The doctor should not need to reconstruct the patient's current situation by manually reading a long chronological Timeline.

---

# 17. D20-13 — Clinical safety boundary

The following remain OUT OF SCOPE unless a later explicit Decision opens them:

```text
automatic diagnosis
automatic clinical classification
automatic abnormal-result interpretation
automatic treatment recommendation
rule-engine treatment advice
AI clinical reasoning
AI-generated clinical truth
automatic ICD coding
legal digital signature / qualified e-signature claim
invented score or instrument semantics
```

The system may provide factual workflow reminders such as:

```text
result not yet reviewed
open follow-up task
episode close warning
missing optional source-form field
```

provided such reminders do not assert clinical interpretation.

---

# 18. Selective supersession map

| Prior authority | DEC-020 disposition |
|---|---|
| DEC-010 — Facility / Room / responsible clinician / handover / Encounter context / vital copy-forward | **PRESERVE** |
| DEC-012 — one logical Diagnosis chain / free text / no ICD / no auto-diagnosis | **PRESERVE + CLARIFY** multiple diagnoses may be written in the one textbox |
| DEC-012 — CarePlan/CareTask explicit linkage and amendment concurrency | **PRESERVE** unless later Contract needs a narrowly scoped change |
| DEC-013 — Initial Hemorrhoid Encounter ungrouped; first Return starts Hemorrhoid treatment episode | **RE-AFFIRM** |
| DEC-013 / later implementation — completed Follow-up Assessment as hard close prerequisite | **SUPERSEDE hard prerequisite only** |
| DEC-013 — a new clinical decision on a Return Encounter may create a new CarePlan instead of amending the old CarePlan | **PRESERVE** |
| DEC-015 — `workflowKind` explicit discriminator; no inference from free text | **PRESERVE** |
| DEC-016 — `CareEpisode` used as Case/course-level storage rather than as a treatment-method label | **PRESERVE WITH CLARIFICATION**: it does not require Initial Encounter membership |
| DEC-016 — rule that the Initial Hemorrhoid Encounter has a Case immediately and Return reuses that Case | **SUPERSEDE for Hemorrhoid workflow** |
| DEC-016 legacy/future rule re-parenting Initial Encounter into Case | **SUPERSEDE for target semantics; synthetic reconciliation strategy deferred to Contract A** |
| DEC-016 TreatmentPathway / Investigation / provenance / multi-modality Treatment Decision | **PRESERVE unless explicitly changed later** |
| DEC-016 Longo as TreatmentPathway rather than sibling treatment-method Case | **PRESERVE as architectural direction** |
| DEC-017 governance/SSOT reconciliation | **PRESERVE** |
| DEC-018 Admin boundary / User Management | **PRESERVE** |
| DEC-019 Staff Profile / Credential / Facility Assignment | **PRESERVE; DEC-019 remains OWNER CLOSED** |
| Full Product Refinement roadmap | **STILL DEFERRED** |
| AI / CORE-05 | **STILL DEFERRED** |

---

# 19. Implementation decomposition after DEC-020 lock

DEC-020 authorizes no implementation by itself.

After Owner Lock, implementation should be split into three Contracts / packages.

## Package A — Workflow Semantic Reconciliation — P0

Target:

```text
Initial Hemorrhoid Encounter stays episodeId=null
First Return creates/resolves ACTIVE HEMORRHOID_TREATMENT
Subsequent Return reuses it
>1 active → conflict
Close = Doctor explicit, no hard Follow-up Assessment prerequisite
Reopen/recurrence remains explicit
Responsible-clinician UI wording reconciled
```

Expected risk:

```text
transaction
concurrency
lifecycle invariant
synthetic-data reconciliation
```

Execution policy:

```text
Claude Code implementation
→ targeted tests
→ ChatGPT direct source review
→ one fresh Codex focused independent audit
```

Codex audit is focused on high-risk lifecycle/concurrency delta only, not a full-project repeat audit.

## Package B — Hemorrhoid Clinical Fidelity + Functional UX

Target:

```text
Hemorrhoid Examination v2
Patient Dashboard
Clinical View
form-faithful capture/rendering
factual Investigation status
Diagnosis/Treatment/Follow-up visibility
Timeline moved to History role
```

Execution:

```text
Claude Code implementation
→ ChatGPT source review
→ Owner + BS Thái browser/workflow acceptance
```

Codex is NOT mandatory unless Package B unexpectedly introduces schema/migration/high-risk invariants.

## Package C — Procedure / Investigation evolution

Target:

```text
0..N actual procedures per Encounter
performed-treatment representation
reuse-first TreatmentPathway analysis
Investigation refinements not already supported
```

If schema/migration/cardinality changes are required:

```text
Claude Code implementation
→ ChatGPT source review
→ focused independent Codex audit
```

---

# 20. Out of scope for DEC-020

Not authorized by this Decision:

- real-patient runtime;
- production deployment;
- legal/compliance certification;
- hospital HIS replacement;
- generic EMR expansion;
- generic form-builder platform;
- full e-prescription platform;
- insurance/BHYT workflow;
- billing/payment workflow;
- hospital admission/discharge system;
- automatic clinical advice;
- AI clinical decision support;
- ICD implementation;
- full surgical-hospital administrative workflow;
- unreviewed procedure/surgery catalogs;
- full visual rebrand / animation / cosmetic Product Refinement.

---

# 21. Privacy / safety / provenance

All development, migration proof, acceptance and screenshots remain synthetic-only until separate Owner authorization.

Requirements preserved:

- tenant isolation;
- immutable completed clinical records;
- append-only amendment lineage;
- actor/provenance audit;
- no silent clinical inference;
- no fabricated historical clinical data;
- no patient identifiers in Git/test evidence beyond authorized synthetic fixtures.

---

# 22. Pre-lock review gate

**Status:** `COMPLETED — ONE EXTERNAL PASS`

The required external pre-lock review pass was completed on 2026-08-31. The reviewer compared this Decision against `AGENTS.md`, the relevant prior Decisions and the latest available repository state, and raised three non-material pre-lock corrections that are incorporated in DRAFT v0.2:

1. remove invented subsection labels `D16-01` / `D16-02` / `Option 2` and cite the actual DEC-016 rule by description;
2. record the current reported `TreatmentPathway` ↔ Case linkage constraint as an explicit Contract A verification item without deciding a schema change in DEC-020;
3. explicitly preserve the DEC-013 rule that a new clinical decision on a Return Encounter may create a new CarePlan instead of amending the old one.

## Review limitation

The reviewer could not fetch local baseline `a2059ff6ea2796eee0a798d754b95e70221d2504` from GitHub because that checkpoint had not been pushed to the remote at review time. Therefore the review was repo-grounded against the nearest accessible repository state, not byte-for-byte against the local DEC-020 baseline.

This limitation is accepted for pre-lock readiness only if Owner chooses to accept it explicitly. Package A T0 still MUST directly inspect the local source at the actual implementation baseline and record exact `VERIFIED: <path>` evidence before any code change.

No second external review pass is required for the v0.2 corrections above because they do not change the substantive Owner decisions.

No implementation is authorized by completion of this review.

---

# 23. Owner lock effect

If Owner later declares:

```text
DEC-020 — OWNER LOCKED
```

then:

1. Sections D20-01→D20-13 become the newest authoritative clinical/product decisions for their stated scope.
2. The selective supersession map becomes authoritative.
3. Package A Contract preparation is authorized.
4. Package B/C implementation is NOT automatically authorized until their respective Contracts are locked.
5. Real-patient runtime and production remain NOT AUTHORIZED.
6. Git commit/push/merge/tag still require separate Owner authority according to repository governance.

---

# 24. Owner Lock record

**Owner decision:** `OWNER LOCK DEC-020 v0.2`  
**Lock date:** `2026-08-31`  
**Locked baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504`  
**Baseline-review limitation:** `EXPLICITLY ACCEPTED BY OWNER`

```text
DEC-019
→ OWNER CLOSED
→ durable baseline: a2059ff6ea2796eee0a798d754b95e70221d2504

DEC-020 v0.2
→ EXTERNAL PRE-LOCK REVIEW COMPLETED
→ OWNER LOCKED
→ D20-01 ... D20-13 AUTHORITATIVE FOR THEIR STATED SCOPE
→ selective supersession map AUTHORITATIVE
→ Package A Contract v0.2 OWNER LOCKED — 2026-08-31
→ Package A T0→T9 IMPLEMENTATION AUTHORIZED subject to mandatory T0 STOP conditions
```

The accepted baseline-review limitation does not waive Package A T0 source verification. Package A MUST inspect the actual local source at its execution baseline and record exact `VERIFIED: <path>` evidence before any code change.

Real-patient runtime and production remain `NOT AUTHORIZED`.  
Git commit / push / merge / tag remain separately Owner-controlled.
