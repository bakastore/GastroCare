# GastroCare — Trạng thái dự án

**Current gate — 2026-08-31:** DEC-020 Package B **B-GOV — GOVERNANCE LANDING ONLY**.
Contract v0.2 **OWNER LOCKED**; external pre-lock review **COMPLETED — PASS**;
material blockers **NONE**; Package A prerequisite **SATISFIED**; T0→T12
**OWNER AUTHORIZED**, implementation **NOT YET STARTED**. Governance diff chờ
ChatGPT / Owner review và checkpoint riêng; không thực hiện Package B T0 ở task này.

**Cập nhật:** 31/08/2026 — **DEC-019 — Staff Profile & Credential Management v1:
OWNER CLOSED** (Owner-directed governance closure 2026-08-31). DEC-019 +
Implementation Contract v0.1 (`docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`)
remain OWNER LOCKED as historical authority; T0→T6 implementation existed in the
working tree and is preserved. `T7` (Fresh Codex independent focused read-only
audit) = **WAIVED BY OWNER — NOT EXECUTED**; `T8` (Owner Synthetic Acceptance) =
**WAIVED BY OWNER — NOT EXECUTED**. No PASS / acceptance claim for DEC-019 (no T7
PASS, no T8 PASS, no Owner Synthetic Acceptance, no additional Technical
Acceptance, no Product Acceptance). Last closed work package = DEC-020 Package A — Workflow Semantic Reconciliation — OWNER CLOSED (2026-08-31).

**DEC-020 — Hemorrhoid Clinical Workflow Reconciliation & Functional Clinical UX:
OWNER LOCKED (2026-08-31)** at locked reference baseline
`a2059ff6ea2796eee0a798d754b95e70221d2504`; external pre-lock review COMPLETED;
documented baseline-review limitation EXPLICITLY ACCEPTED BY OWNER. Current
authority = DEC-020 v0.2 — OWNER LOCKED. DEC-020 clinical/domain semantics and
the Package A Contract v0.2 (`docs/DEC-020_PACKAGE_A_WORKFLOW_SEMANTIC_RECONCILIATION_IMPLEMENTATION_CONTRACT.md`)
remain OWNER LOCKED.

**DEC-020 Package A — Workflow Semantic Reconciliation: OWNER CLOSED —
2026-08-31.** Execution-START baseline `a03b1878dd42ca80956418c67da6f79d0b560572`
(where Package A execution began — **NOT** `A_CLOSED_SHA`). Package A OWNER-CLOSED
implementation checkpoint: **`A_CLOSED_SHA` =
`0c865a26c4425a1c3fe429bb8e42238562025801`** (commit `0c865a2` — `feat:
checkpoint DEC-020 Package A owner-closed`). The Package A implementation +
T10/T11 corrections + closure governance are **COMMITTED** at `A_CLOSED_SHA`.
Execution/review history: `T0 → T9` COMPLETED; `T10` ChatGPT direct source
review = **PASS**; `T11` initial fresh Codex independent audit = **FAIL —
CORRECTION REQUIRED** (initial severity P0=0 / P1=1 / P2=2 / P3=0); correction
batch COMPLETED; focused source recheck = PASS; `T11` focused independent
re-audit = **PASS — NO P0/P1** (final severity P0=0 / P1=0 / P2=1 / P3=0).
Residual **P2 — Unicode reason-length parity** = NON-BLOCKING, DEFERRED (recorded
in the DECISION_LOG `DEC-020 PACKAGE A CLOSURE` record). Owner closure of Package
A is NOT Technical Acceptance beyond the audit gates and is NOT Product/production
acceptance.

Package B (Clinical Form Fidelity + Functional UX) / Contract v0.2 = **OWNER
LOCKED — 2026-08-31**. External pre-lock review **COMPLETED — PASS**; material
blockers **NONE**. No clinical/product or T0→T12 substantive implementation
requirement changed at Owner Lock; execution-baseline governance was subsequently
changed by explicit Owner overlay (2026-08-31). Original external review remains
historically valid; no second review required for this governance-only overlay.
Package A prerequisite **SATISFIED** tại
immutable `A_CLOSED_SHA` `0c865a26c4425a1c3fe429bb8e42238562025801`.
T0→T12 **OWNER AUTHORIZED**, subject to Contract T0 blocking verification and
STOP conditions; implementation **NOT YET STARTED**. Authority mới được append
trong DECISION_LOG `DEC-020 PACKAGE B — OWNER LOCK AND IMPLEMENTATION AUTHORITY`;
không viết lại historical DEC-020 / Package A wording.

Canonical Contract:
[`DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md`](DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md).
Canonical coordination map:
[`DEC-020_MASTER_EXECUTION_MAP.md`](DEC-020_MASTER_EXECUTION_MAP.md).
Pre-B-GOV branch `correction/owner-acceptance-slice1-3`; verified HEAD
`cdc4f2321f7176fd3c50023d7dd17676c0cd92f6`; working tree CLEAN; `A_CLOSED_SHA`
ancestor; post-A delta governance/docs only. Đây là trạng thái CLEAN trước lần
B-GOV landing ban đầu; **current dirty B-GOV = governance preparation only**, đúng
5 docs, không phải clean execution baseline.

**Historical reviewed v0.2 rule:** Contract rebind về clean Package A
closure/checkpoint SHA; Master Execution Map rebind về literal `A_CLOSED_SHA`.
**NEWER Owner execution-governance overlay — 2026-08-31** supersedes only that
literal checkpoint mechanic và cho phép clean governance-only descendant.
Operative future Package B execution baseline = **`B_GOV_SHA`**, chỉ sau direct
review corrected governance diff → Owner authorization riêng → governance-only
commit/push → clean state trên đúng branch. `B_GOV_SHA` **NOT YET ASSIGNED**;
không phải rule có sẵn trong original reviewed v0.2 và không relabel
`A_CLOSED_SHA` hoặc pre-B-GOV HEAD. T0 phải verify `A_CLOSED_SHA` ancestor, toàn bộ
`A_CLOSED_SHA..HEAD` governance/docs only, không unexplained application/backend/
frontend/schema/migration/test/tooling delta, CLEAN working tree, Owner-authorized
branch và ghi actual HEAD thành `PACKAGE_B_BASE_SHA`. Các điều kiện này chưa được
thực hiện ở Package B T0; B-GOV correction không bắt đầu implementation. Package C = **NOT ACTIVE / DRAFT / DISCOVERY-DEPENDENT / NOT
IMPLEMENTATION-AUTHORIZED**; C0 không mở.

Baseline = DEC-018 CLOSED — OWNER ACCEPTED — remote
checkpoint `7d33e02c36f5e862c50717c340deea86ad046e47`; durable pre-Package-A
baseline `a2059ff6ea2796eee0a798d754b95e70221d2504`; Package A implementation +
T10/T11 corrections COMMITTED at `A_CLOSED_SHA`
`0c865a26c4425a1c3fe429bb8e42238562025801`. SYNTHETIC DATA ONLY; real-patient
runtime/data, production deployment and AI clinical reasoning remain NOT
AUTHORIZED (Package A closure/checkpoint/push is not production acceptance); no
commit/push/merge/tag without separate Owner authorization. Next gate =
ChatGPT direct review of corrected B-GOV diff → Owner decision → Owner separately authorizes one governance-only commit/push → actual resulting commit SHA becomes `B_GOV_SHA` → working tree/branch verified clean → Package B T0.

Prior context: **DEC-018 — Admin Boundary / User Management v1: T0 → T8 CLOSED —
OWNER ACCEPTED** (2026-08-30), committed at remote checkpoint `7d33e02`. T7 Fresh
Codex independent focused audit completed: 1 MEDIUM finding (disabled
Investigation assignee could still be selected/accepted as a NEW Order
assignee) — remediated and Owner-accepted as closed. T8 Owner Synthetic
Acceptance PASS, incl. T8.9 Last Clinic Admin protection PASS. DEC-017
implementation checkpoint `6dd8d52`; DEC-016 backend `TECHNICAL EXECUTION
COMPLETE — INDEPENDENT FOCUSED AUDIT CLOSED — PASS` (Fresh Codex Session B,
2026-08-29); AppSidebar.tsx Demo UI Navigation v1 OWNER LOCKED. System Admin,
production, real-patient runtime, CORE-05 remain OUT OF SCOPE.

DEC-016 Session A T0 → M7 implementation/testing PASS (self-attested). Backend 354/354, frontend 59/59, browser 9/9; M0 và backup/restore PASS. Fresh Codex Session B independent focused read-only audit: PASS (R1–R5 PASS; targeted 27/27 PASS; migration probe PASS; Prisma schema validation PASS; no repository file changed). Owner product acceptance NOT CLAIMED. [Nguồn authority](DEC016_OWNER_AUTHORITY.md), [implementation notes](13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md).

**Loại dự án:** GREENFIELD

**Định hướng sản phẩm:** CORE-FIRST

**Phương thức nhập liệu ban đầu:** MANUAL

**AI:** DEFERRED — lớp giá trị gia tăng trong tương lai

Tài liệu này chỉ ghi nhận trạng thái đã được xác minh. Thứ bậc thẩm quyền:

```text
Quyết định Owner rõ ràng mới nhất
> Quyết định Owner trước đó
> Trạng thái dự án đã xác minh
> Baseline đã phê duyệt
> Giả định đang làm việc
> Khuyến nghị của AI
```

## 1. Trạng thái tổng thể

| Hạng mục | Trạng thái |
|---|---|
| FOUNDATION | CLOSED |
| Technical Foundation (nền tảng kỹ thuật) | CLOSED |
| CORE-01 | CLOSED — OWNER ACCEPTED |
| CORE-02 | CLOSED — OWNER ACCEPTED |
| CORE-03 / Technical Core (lõi kỹ thuật) | CLOSED — OWNER ACCEPTED |
| GastroCare Core tổng thể | IN PROGRESS |
| Real-world Clinical Core implementation (triển khai lõi lâm sàng theo thực tế) | IN PROGRESS — Hemorrhoid Vertical Slice 1 TECHNICALLY ACCEPTED (historical); Vertical Slice 2 T0→T7 EXECUTION COMPLETE (historical, Owner product acceptance NOT CLAIMED); Vertical Slice 3 T0→T7 TECHNICAL EXECUTION COMPLETE under DEC-013; T4/T7 CLOSED — PASS; PR #5 MERGED to `main` at `4a73a0c8764558d2776adffcf1d26092f6456634`; Owner product acceptance NOT CLAIMED |
| Owner Synthetic Clinical Acceptance | Longo-only Gate G: RETIRED BY OWNER — không tiếp tục vì workflow sản phẩm đã đổi; không suy ra CORE-04 Owner product acceptance |
| AUTHORIZED REAL-WORLD PILOT ACCEPTANCE | FUTURE GATE — chưa được phép mở |
| Continuous Care (chăm sóc liên tục) | NOT COMPLETE |
| Product Refinement / UI-UX (tinh chỉnh sản phẩm/giao diện-trải nghiệm) | DEFERRED đến khi Clinical Core được chấp nhận |
| AI Value-Added Layer | DEFERRED |
| Hemorrhoid Vertical Slice 1 | `TECHNICALLY ACCEPTED` — Independent Codex Gate CLOSED; accepted baseline `2ea529ee200a0a37a77cebb9a750f70adde57618` |
| Hemorrhoid Vertical Slice 2 | Execution sequence `T0→T7 COMPLETE` — Diagnosis → Treatment Decision → CarePlan/Follow-up → Return Encounter; T4 focused Independent Codex Gate `CLOSED — PASS` (2026-08-26); T7 TARGETED SYNTHETIC ACCEPTANCE `PASS` (Owner-confirmed 2026-08-26); Owner product acceptance NOT CLAIMED |
| Hemorrhoid Vertical Slice 3 | `OWNER LOCKED` — Continuous Care Loop; Contract v0.1 `docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md`; authority DEC-013; T0→T7 TECHNICAL EXECUTION COMPLETE; T4/T7 CLOSED — PASS; final T7 implementation commit `24b4abec7b932acd329d711f7cb9ca3773b204f3` (historical implementation evidence); PR #5 MERGED to `main` at `4a73a0c8764558d2776adffcf1d26092f6456634`; T7 raw re-verified on merged main; Owner product acceptance NOT CLAIMED; next gate `OWNER SYNTHETIC PRODUCT ACCEPTANCE — Slice 1→3` |
| Current product direction | `HEMORRHOID REAL-WORLD CLINICAL WORKFLOW` — DEC-010→013 clinical baseline, DEC-016 Case/Pathway/Investigation expansion |
| CORE-05 | `CASE INTELLIGENCE` — giữ nguyên; chưa mở trong checkpoint này |

Không được diễn giải việc Technical Core đã đóng là toàn bộ GastroCare Core đã đóng.

### Bối cảnh pilot và chuyên khoa

| Hạng mục | Trạng thái |
|---|---|
| First pilot user | BS Thái — OWNER CONFIRMED |
| First specialty | Gastroenterology (tiêu hóa) — WORKING ASSUMPTION, chưa được Owner xác nhận thành quyết định mới |

Giả định về chuyên khoa đầu tiên không phải Owner Decision.

## 2. Baseline kỹ thuật

| Thuộc tính | Giá trị |
|---|---|
| Nhánh | `core/core-03-technical-core-completion` |
| SHA | `1a95f57f0b19bddbfcd817101d5c0c1135d90686` |
| Tag | `technical-core-v0.1` |
| Technical Core | CLOSED |
| Kiểm toán kỹ thuật cuối | PASSED |
| Backend | 99/99 |
| Frontend | 20/20 |
| Browser E2E | 4/4, ổn định qua hai lần chạy toàn bộ liên tiếp |
| Sao lưu/khôi phục | PASSED, gồm `ClinicalFormSubmission` |
| Quét privacy/Git cuối | PASSED |

Technical Core hiện có các primitive (thành phần nền tảng) như `Patient`, `Encounter`, `CarePlan`, `CarePlanVersion`, `CareTask`, `AuditEvent`, Timeline dạng read projection (hình chiếu chỉ đọc) và `ClinicalFormSubmission`. Việc có `CareTask` không đồng nghĩa Continuous Care đã hoàn tất.

## 3. Đồng bộ bằng chứng thực tế

| Hạng mục | Trạng thái |
|---|---|
| Real-world evidence alignment (đồng bộ bằng chứng thực tế) | COMPLETE |
| Kiểm toán toàn bộ corpus | 270/270 DOCX đã xử lý |
| CareEpisode/domain architecture (kiến trúc miền) | LOCKED |
| Atomic Field Dictionary | 118/118 khái niệm đã được tính đến; 0 unmapped |
| Clinician Review | LOCKED FOR v1 SCOPE |
| Longo Clinical Workflow v1.0 | OWNER LOCKED |

`118/118 accounted for` chỉ có nghĩa mọi khái niệm đều được tính đến, không có nghĩa mọi khái niệm đã sẵn sàng triển khai hoặc phải trở thành trường nhập liệu thường ngày.

### Ranh giới bằng chứng lịch sử của các thang đo

| Thang đo | Dữ liệu lịch sử thực tế đã xác minh |
|---|---|
| Wexner | UNDETERMINED |
| HDSS | UNDETERMINED |
| SHS-HD | UNDETERMINED |

Không được biến các trạng thái `UNDETERMINED` thành dữ kiện đã xác nhận. Định nghĩa/chấm điểm HDSS và SHS-HD thường quy vẫn chờ xác nhận lâm sàng.

## 4. Clinical Workflow SSOTs

### 4.1 Longo

[`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md) tiếp tục là authoritative SSOT (nguồn sự thật duy nhất có thẩm quyền) cho Longo sub-workflow (quy trình con Longo).

```text
Status: OWNER LOCKED
Version: 1.0
Implementation status: CORE-04 TECHNICAL/CLINICAL BASELINE INDEPENDENTLY VERIFIED
Owner product acceptance: NOT CLAIMED
Longo-only Gate G: RETIRED BY OWNER
Real-patient runtime: NOT AUTHORIZED
```

Longo là reusable verified baseline (baseline đã kiểm chứng có thể tái sử dụng); không bị Hemorrhoid workflow supersede hoặc viết lại.

### 4.2 Hemorrhoid

[`10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`](10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md) là authoritative clinical SSOT cho Hemorrhoid real-world workflow theo DEC-011.

```text
Status: OWNER LOCKED
Version: 1.0
Vertical Slice 1: TECHNICALLY ACCEPTED
Accepted baseline: 2ea529ee200a0a37a77cebb9a750f70adde57618
Vertical Slice 2: TECHNICAL EXECUTION COMPLETE
Vertical Slice 2 authority (historical, DEC-012 authorized implementation): DEC-012 + docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md
T4 independent audit: CLOSED — PASS (fresh Independent Codex READ-ONLY audit, 2026-08-26)
T4 baseline: 1602b114ccb50482c890754d59a44e3958e61c59
T4 verified against HEAD: ca347bc2b043c6050b5635b2e58ef8cd977e320e
T4 audit results: READY FOR T4 ACCEPTANCE: YES; targeted real-PostgreSQL T4 E2E 22/22 PASS; C1-C4 PASS; Serializable transaction PASS; expectedCurrentVersionId/stale-write protection PASS; serialization/write conflict→409 PASS; no automatic retry PASS; CareTask 0..1 OPEN generic cardinality PASS; atomic audit PASS; rollback proof PASS; schema/migration NO CHANGE; blockers NONE; audit strict READ-ONLY, worktree unchanged
T5/T6 were implemented after the T4 implementation baseline; the fresh Independent Codex READ-ONLY audit on 2026-08-26 verified that T5/T6 did not modify T4 production behavior.
T7 TARGETED SYNTHETIC ACCEPTANCE: PASS (Owner-confirmed 2026-08-26) — golden path 17/17 PASS; mandatory negative acceptance cases PASS; relevant regression tests 177/177 PASS; backend build PASS; git diff --check PASS; no production-code change; schema/migration NO CHANGE; blockers NONE.
Hemorrhoid Vertical Slice 2 execution sequence T0→T7: COMPLETE (technical execution). Owner product acceptance: NOT CLAIMED.
Real-patient runtime: NOT AUTHORIZED
```

### 4.3 Hemorrhoid Vertical Slice 3

```text
Status: OWNER LOCKED
Authority: DEC-013
Contract: docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
T0→T7: TECHNICAL EXECUTION COMPLETE
T4: CLOSED — PASS
T4 independent audit baseline: 69808c6a52b4b6ec364b338fdeab39e5719487f6
T4 audit results: 12/12 C1-C4 real-PostgreSQL concurrency tests PASS; blockers NONE
T7: CLOSED — PASS
T7 backend regression (pre-merge, Slice 3 scope): 241/241 PASS
T7 backend regression 241/241 scope reconciliation: command literal/source artifact UNVERIFIED in repo/git docs; count matches targeted backend E2E subset excluding Gate 2 foundation and CORE-04 Longo specs: clinical-forms.e2e-spec.ts 35; core01-clinical-walking-skeleton.e2e-spec.ts 42; core03-hardening.e2e-spec.ts 24; hemorrhoid-slice1.e2e-spec.ts 36 runtime cases (34 static it() + one it.each with 2 cases); hemorrhoid-slice2-t7-acceptance.e2e-spec.ts 7; hemorrhoid-slice2.e2e-spec.ts 57; hemorrhoid-slice3-t1.e2e-spec.ts 12; hemorrhoid-slice3-t2.e2e-spec.ts 7; hemorrhoid-slice3-t3.e2e-spec.ts 5; hemorrhoid-slice3-t4.e2e-spec.ts 12; hemorrhoid-slice3-t5.e2e-spec.ts 1; hemorrhoid-slice3-t7-acceptance.e2e-spec.ts 3; total 241.
Frontend unit/component tests: 37/37 PASS
Slice 3 focused Playwright browser acceptance: 1/1 PASS ×2
Existing browser regression: 7/7 PASS
Final T7 implementation commit (historical implementation evidence): 24b4abec7b932acd329d711f7cb9ca3773b204f3
Schema/migration: NO CHANGE

--- Post-merge reconciliation (2026-08-27) ---
PR #5 (discovery/hemorrhoid-real-world-workflow -> main): MERGED
PR feature head: acb1eb2be03dd633a93afde99a5e8a5bd1b03c5a
Merged main baseline: 4a73a0c8764558d2776adffcf1d26092f6456634
Diff 24b4abec -> acb1eb2: docs/PROJECT_STATE.md only (1 file changed, 46 insertions(+), 38 deletions(-))
Diff acb1eb2 -> 4a73a0c: no file-content difference (merge commit only)
T7 raw re-verification executed locally directly on merged main:
  targeted T7 acceptance: 3/3 PASS
  full backend E2E regression: 331/331 PASS
  backend 331/331 scope reconciliation: `npm run test:e2e` from `backend/` maps to `jest --config ./test/jest-e2e.json --runInBand`, which includes every `backend/test/*.e2e-spec.ts`; static source count is 311 `it()` blocks plus 20 runtime-expanded cases from 5 `it.each([...])` blocks, total 331.
  frontend unit/component: 37/37 PASS
  backend build: PASS
  frontend build/typecheck: PASS
  9 Prisma migrations found; no pending migrations
  git diff --check: PASS
  pre/post-run worktree: CLEAN
  the two "C4 injected failure (test-only, synthetic)" log lines are intentional negative-path rollback tests; their suites PASS
Blockers: NONE
Owner product acceptance: NOT CLAIMED
Next gate: OWNER SYNTHETIC PRODUCT ACCEPTANCE — Slice 1→3 — requires explicit Owner/BS Thái confirmation; NOT yet PASS
Real-patient runtime: NOT AUTHORIZED
CORE-05: NOT OPENED
```

## 5. Giai đoạn và hướng tiếp theo

**Giai đoạn hiện tại:** GASTROCARE CORE — IN PROGRESS

**Hướng sản phẩm hiện tại:** HEMORRHOID REAL-WORLD CLINICAL WORKFLOW

**Last completed checkpoint trước DEC-016 (history):** `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 3` — T0→T7 TECHNICAL EXECUTION COMPLETE, MERGED to `main` (PR #5) at baseline `4a73a0c8764558d2776adffcf1d26092f6456634`.

**Current work package:** DEC-020 Package B — B-GOV governance landing only;
Contract v0.2 OWNER LOCKED, T0→T12 OWNER AUTHORIZED, implementation NOT YET STARTED.
Current gate / checkpoint requirements: see §7.

**Historical work package:** `DEC-016 FULL IMPLEMENTATION — CODEX SESSION A`; T0 → M7 technical execution PASS (self-attested). Committed as implementation checkpoint `6dd8d52` per DEC-017 (Owner xác nhận, commit tạm thời do gấp demo); `6dd8d52` cũng gộp Demo UI/UX (`frontend/src/pages/admin/*`, `AppSidebar.tsx`, route `/admin/*`). Local working-tree state được kiểm tra riêng tại mỗi execution gate.

**Historical DEC-016 authority:** `DEC-016 / IMPLEMENTATION CONTRACT v0.3 — OWNER LOCKED`, theo fallback requirements Owner cung cấp tại `docs/DEC016_OWNER_AUTHORITY.md`. Cho phép schema, migration, reconciliation và local synthetic implementation/testing; không mở real data/production/CORE-05.

**DEC-015 M0 migration checkpoint:** `CLOSED — PASS`.

**DEC-015 correction technical evidence (history, trước DEC-016):**

- backend E2E: `339/339 PASS` (`cd backend && npm run test:e2e`; 19 suites; +8 new DEC-015 cases).
- frontend unit/component: `55/55 PASS` (`cd frontend && npm test`).
- browser regression: `8/8 PASS` (`cd frontend && ./e2e/run-e2e.sh`; incl. CORE-04 T15 full Longo pathway and Hemorrhoid continuous-care golden path).
- DEC-015 M0 migration: immutable — `20260827000000_dec015_encounter_workflow_kind/migration.sql` SHA256 `ad0d69a432ef2bec9e342173f7467e0f11ede0f62574628a4d4827eb17e21a04`; `backend/prisma/schema.prisma` unchanged since M0.
- Blockers: NONE.

Slice 3 remains historical completed work. The evidence list below is Slice 3 execution history and is not restated as DEC-015 history:

- Slice 3 T0→T7: TECHNICAL EXECUTION COMPLETE.
- T4 concurrency gate: CLOSED — PASS.
- T4 independent Codex READ-ONLY audit: PASS; 12/12 C1-C4 real-PostgreSQL tests PASS; blockers NONE.
- T7 targeted synthetic acceptance: CLOSED — PASS.
- Pre-merge Slice 3-scope backend regression: 241/241 PASS.
- Frontend unit/component tests: 37/37 PASS.
- Focused Slice 3 Playwright browser acceptance: 1/1 PASS ×2.
- Existing browser regression: 7/7 PASS.
- Final T7 implementation commit (historical implementation evidence): `24b4abec7b932acd329d711f7cb9ca3773b204f3`.
- PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`): MERGED. Feature head `acb1eb2be03dd633a93afde99a5e8a5bd1b03c5a`; merged main baseline `4a73a0c8764558d2776adffcf1d26092f6456634`.
- T7 raw re-verification executed locally directly on merged main: targeted 3/3 PASS; full backend E2E regression 331/331 PASS; frontend unit/component 37/37 PASS; backend build PASS; frontend build/typecheck PASS; 9 Prisma migrations found, no pending migrations; `git diff --check` PASS; pre/post-run worktree CLEAN.
- Schema/migration: NO CHANGE.
- Blockers: NONE.

Slice 2 remains historical evidence only (technical execution complete, historical completed work package).

Owner product acceptance: NOT CLAIMED. Technical PASS at every gate above does not equal Owner product acceptance.

**DEC-016 independent audit gate: CLOSED — PASS.** Fresh Codex Session B đã hoàn tất independent focused read-only audit trên implementation checkpoint `6dd8d52` (2026-08-29): R1 Schema/Migration, R2 Case/TreatmentPathway, R3 Investigation/Authorization, R4 Transaction/Concurrency, R5 Tenant/Provenance — tất cả PASS; targeted 27/27 PASS; PRE-DEC016 → DEC-016 migration probe PASS; Prisma schema validation PASS; findings NONE; blockers NONE; audit changed no repository files. M7 của Session A là tự kiểm thử implementation và không phải independent audit; audit độc lập này là verified technical verification, không phải Owner Decision mới. Đây chỉ đóng technical independent-audit gate; Owner product acceptance vẫn NOT CLAIMED.

**Owner Synthetic Product Acceptance:** NOT CLAIMED. M0 dùng fixture synthetic Run2-shape, không phải dữ liệu Run2 thực tế của Owner. Quyền product acceptance vẫn thuộc Owner/BS Thái.

GastroCare Core: IN PROGRESS (unchanged). Continuous Care: NOT COMPLETE (unchanged). Product Refinement: DEFERRED (unchanged). `CORE-05 = CASE INTELLIGENCE — NOT OPENED` (unchanged).

Implementation/test/acceptance data: SYNTHETIC DATA ONLY.
Real-patient runtime and production: NOT AUTHORIZED.
`CORE-05 = CASE INTELLIGENCE — NOT OPENED`.

## 6. Ranh giới vận hành và an toàn

| Hạng mục | Trạng thái |
|---|---|
| Real-patient runtime | NOT AUTHORIZED |
| Dữ liệu bệnh nhân thật | NOT AUTHORIZED |
| Pilot chính thức với BS Thái | NOT STARTED |
| Production | NOT AUTHORIZED |
| Cơ sở dữ liệu production | NONE |
| Legal / privacy review | OPEN / REQUIRED |
| Historical import implementation | OUT OF CURRENT SCOPE |

Chỉ được dùng synthetic data (dữ liệu giả lập) cho triển khai, kiểm thử và nghiệm thu hiện tại. Bằng chứng từ corpus thực tế chỉ được ghi nhận dưới dạng bằng chứng/kết quả tổng hợp đã được khử thông tin nhận dạng. Các sự cố sanitizer lịch sử vẫn thuộc hồ sơ quản trị; tài liệu SSOT không tái tạo giá trị bị lộ, dữ liệu định danh hoặc nội dung lâm sàng thô.

## 7. CURRENT EXECUTION CONTEXT

| Thuộc tính | Giá trị |
|---|---|
| Current branch | `correction/owner-acceptance-slice1-3` |
| DEC-016 implementation checkpoint | `6dd8d5226b6f4d2c264227226cb996900aa3d9f6` — COMMITTED/PUSHED; Owner xác nhận theo DEC-017 |
| Repository state reconciliation | Mô tả trước đây "chưa commit theo lệnh Owner" / baseline `c0dfe1a4` đã lỗi thời kể từ checkpoint `6dd8d52`; local worktree state được kiểm tra riêng tại mỗi execution gate |
| Pre-DEC-016 T0 baseline (history) | `c0dfe1a4f774bef334dd2c2e0eac45f89a2e106b` — CLEAN; C1–C5 + DEC-015 CLOSED / PASS theo Owner authority |
| Current phase | `GASTROCARE CORE — IN PROGRESS` |
| Last closed work package | `DEC-020 Package A — Workflow Semantic Reconciliation` — **OWNER CLOSED (2026-08-31)**; `A_CLOSED_SHA` = `0c865a26c4425a1c3fe429bb8e42238562025801` (execution-START baseline `a03b1878…`, kept distinct); T10 PASS; T11 initial FAIL → corrected → focused re-audit PASS — NO P0/P1; residual P2 deferred; implementation COMMITTED at `A_CLOSED_SHA`. Prior: `DEC-019 — STAFF PROFILE & CREDENTIAL MANAGEMENT v1` — **OWNER CLOSED (2026-08-31)** via Owner-directed governance closure; T0→T6 implementation preserved in working tree; `T7`/`T8` = WAIVED BY OWNER — NOT EXECUTED; no PASS / acceptance claim; Owner Synthetic Acceptance NOT CLAIMED |
| Current work package | `DEC-020 Package B — Clinical Form Fidelity + Functional UX`; current gate **B-GOV — GOVERNANCE LANDING ONLY** |
| Current Contract | `docs/DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md` (v0.2 OWNER LOCKED); coordination: `docs/DEC-020_MASTER_EXECUTION_MAP.md` |
| Contract status | `v0.2 — OWNER LOCKED` (2026-08-31); external pre-lock review **COMPLETED — PASS**; material blockers **NONE**; no clinical/product or T0→T12 substantive implementation requirement changed at lock; execution-baseline governance subsequently changed by newer Owner overlay; original external review historically valid, no second review required |
| Package A execution-START baseline | `a03b1878dd42ca80956418c67da6f79d0b560572` — where Package A execution began. Kept **distinct** from `A_CLOSED_SHA`; not relabelled |
| Package A closed checkpoint (`A_CLOSED_SHA`) | `0c865a26c4425a1c3fe429bb8e42238562025801` — commit `0c865a2` `feat: checkpoint DEC-020 Package A owner-closed`. The immutable Package A OWNER-CLOSED implementation checkpoint (implementation + T10/T11 corrections + closure governance). Do not amend |
| Package A execution / review history | `T0 → T9` COMPLETED. `T10` ChatGPT direct source review = **PASS**. `T11` initial fresh Codex independent audit = **FAIL — CORRECTION REQUIRED** (initial severity P0=0 / P1=1 / P2=2 / P3=0). Correction batch COMPLETED → focused source recheck = PASS → `T11` focused independent re-audit = **PASS — NO P0/P1** (final severity P0=0 / P1=0 / P2=1 / P3=0). History is not rewritten as though the initial `T11` passed |
| Package A residual finding | **P2 — Unicode reason-length parity** — NON-BLOCKING, DEFERRED. Standalone `POST /care-episodes/:id/reopen` and atomic Return `REOPEN_EXISTING` diverge near the 500-character Unicode boundary because the transaction lifecycle helper counts JavaScript `String.length` / UTF-16 code units (e.g. `'r'.repeat(499) + '🙂'` → standalone accepted, atomic recurrence rejected). Does not affect transaction atomicity, single-active invariant, tenant isolation, audit integrity, or data correctness/loss. Not fixed in the closure task; recorded in the DECISION_LOG `DEC-020 PACKAGE A CLOSURE` record |
| Package A implementation state | Complete implementation + T10/T11 corrections + closure governance are **COMMITTED** at `A_CLOSED_SHA` `0c865a26c4425a1c3fe429bb8e42238562025801` |
| Verified pre-B-GOV baseline | Branch `correction/owner-acceptance-slice1-3`; HEAD `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6`; pre-write CLEAN; `A_CLOSED_SHA` ancestor; post-A delta governance/docs only |
| Current dirty B-GOV | Governance preparation/correction only; exact five approved docs; no Package B T0→T12 execution |
| Package B execution baseline | Historical reviewed v0.2: rebind to `A_CLOSED_SHA`. Newer Owner overlay permits clean governance-only descendant `B_GOV_SHA` after corrected governance review / separately authorized commit/push / clean branch and tree; **NOT YET ASSIGNED**. T0 must verify A ancestry, entire `A_CLOSED_SHA..HEAD` docs-only, no unexplained application/backend/frontend/schema/migration/test/tooling delta, CLEAN tree, authorized branch, and actual HEAD recorded as `PACKAGE_B_BASE_SHA` |
| Package B implementation state | **NOT YET STARTED**; no T0 source-verification or implementation/test/acceptance claim in B-GOV |
| Current authorized execution | Package B T0→T12 **OWNER AUTHORIZED**, subject to Contract T0 blocking verification and STOP conditions. Implementation **NOT YET STARTED**; this task executes B-GOV only and stops before T0 |
| Package B / Package C | Package B **OWNER LOCKED / T0→T12 OWNER AUTHORIZED / NOT YET STARTED**; Package A prerequisite **SATISFIED**. Package C **NOT ACTIVE / DRAFT / DISCOVERY-DEPENDENT / NOT IMPLEMENTATION-AUTHORIZED**; C0 NOT OPENED |
| Current authority | Newest explicit Owner decision 2026-08-31: `DEC-020 PACKAGE B — EXECUTION-BASELINE GOVERNANCE OVERLAY` in DECISION_LOG, subsequent to `DEC-020 PACKAGE B — OWNER LOCK AND IMPLEMENTATION AUTHORITY`; reviewed literal A checkpoint rule retained as provenance; Package B v0.2 OWNER LOCKED, T0→T12 OWNER AUTHORIZED. Historical DEC-020 wording preserved. DEC-020 v0.2 — OWNER LOCKED (2026-08-31), locked reference baseline `a2059ff6ea2796eee0a798d754b95e70221d2504`; external pre-lock review COMPLETED; documented baseline-review limitation EXPLICITLY ACCEPTED BY OWNER; D20-01…D20-13 + selective supersession map AUTHORITATIVE. DEC-020 uses selective supersession — prior OWNER LOCKED Decisions (DEC-010→019) remain effective except where the DEC-020 §18 map supersedes; DEC-019 remains OWNER CLOSED. Historical authority: DEC-019 OWNER LOCKED + `docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md` v0.1; DEC-018 OWNER LOCKED + `docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md` v0.2 — CLOSED — OWNER ACCEPTED |
| DEC-018 execution sequence (closed) | `T0 → T6` Claude Code implementation (complete); `T7` Fresh Codex independent focused read-only audit — COMPLETED, 1 MEDIUM finding remediated + Owner-accepted closure; `T8` Owner Synthetic Acceptance — **PASS** (incl. T8.9 Last Clinic Admin protection PASS) |
| Governing local authority (DEC-016 historical) | `docs/DEC016_OWNER_AUTHORITY.md` — bản lưu prompt; không tự nhận là bản Contract đầy đủ |
| Implementation notes/evidence (DEC-016 historical) | `docs/13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md`, `docs/DEC016_SESSION_A_REPORT.md`, `docs/evidence/DEC016_SESSION_A/` |
| Startup domain/schema/privacy SSOT | Current B-GOV / Package B: canonical Contract + Master Execution Map + DEC-020 Owner authority; preserve Package A Contract/closure evidence. Domain/schema/privacy where relevant: docs/04, 05, 06 and applicable DEC-020 selective supersession; Longo 08/09, Hemorrhoid 10/12 remain historical SSOT except explicitly superseded scope |
| Implementation status | DEC-016: T0 → M7 PASS (self-attested) + independent audit CLOSED — PASS; committed as `6dd8d52` per DEC-017. **DEC-018: T0 → T8 CLOSED — OWNER ACCEPTED (2026-08-30)** — committed at remote checkpoint `7d33e02`. **DEC-019: OWNER CLOSED (2026-08-31)** — T0→T6 implementation exists in working tree and is preserved; T7/T8 WAIVED BY OWNER — NOT EXECUTED; no PASS / acceptance claim. **DEC-020 Package A: OWNER CLOSED (2026-08-31)** — `T0 → T9` COMPLETED; `T10` PASS; `T11` initial FAIL — CORRECTION REQUIRED → correction batch COMPLETED → focused source recheck PASS → `T11` focused independent re-audit PASS — NO P0/P1 (final P0=0/P1=0/P2=1/P3=0); residual P2 (Unicode reason-length parity) NON-BLOCKING/DEFERRED; complete implementation + T10/T11 corrections + closure governance **COMMITTED at `A_CLOSED_SHA` `0c865a26c4425a1c3fe429bb8e42238562025801`** (execution-START baseline `a03b1878…` kept distinct); no schema/migration change; SYNTHETIC DATA ONLY. Owner closure ≠ Product/production acceptance |
| Current authorized task | **B-GOV governance landing only** → STOP for ChatGPT / Owner governance diff review. No application edits, no Package B T0→T12 execution, no C0, no Git mutation in this task |
| DEC-018 T7 independent audit | Fresh Codex focused read-only audit — COMPLETED. 1 MEDIUM finding: disabled DOCTOR/NURSE could still be selected via `GET /investigations/assignees` and accepted via `POST /investigations/:id/orders` as a NEW assignee. Remediation: `status = ACTIVE` filter added to both paths in `investigations.service.ts`; targeted E2E added (`dec016-case-workspace.e2e-spec.ts`, CASE 1–4 + historical-assignment survives). Full backend e2e 378/378. Owner accepted the remediation as closing T7 |
| DEC-018 T8 Owner Synthetic Acceptance | **PASS** (2026-08-30). Accepted T8 corrections: reset-password one-time temporary-password handoff modal; unified mutation notification (toast) system; simplified UsersPage (search + list + "+" add); create-user modal; edit-user modal; **T8.9 Last Clinic Admin protection verified PASS** (SERIALIZABLE, no auto-retry, 409, mandatory concurrent test) |
| DEC-018 non-blocking UX note | Facility/Room card interaction can be made clearer in a later pass — recorded, not blocking acceptance |
| DEC-018 T0→T6 evidence | Migration `20260829040958_dec018_admin_boundary_user_management` (additive; prisma validate PASS; migrate status up-to-date; backup/restore verification PASS with post-restore full e2e). Backend: build PASS, unit 80/80, e2e 378/378 (incl. `test/dec018-admin-boundary.e2e-spec.ts` real-PostgreSQL last-Clinic-Admin concurrency). Frontend: build/typecheck PASS, vitest 139/139, lint clean. Browser: `e2e/dec018-admin.spec.ts` PASS; 3 PRE-EXISTING browser failures unrelated to DEC-018 (components byte-identical to baseline `5a7fd67`; one passes in isolation — cross-test pollution) |
| DEC-018 STOP-condition note (accepted) | T4 "DOCTOR → non-DOCTOR role change while responsible clinician for an ACTIVE CareEpisode" reject rule is NOT implemented: CareEpisode has no responsibleClinicianId and no episode-level responsibility/handover model — "active responsibility" is not authoritatively determinable. Per Contract T4 this semantic expansion is stopped and reported; the PATCH role change is allowed and audited (`USER_ROLE_CHANGED`); disabled users are already excluded from clinician selection. An authoritative episode-responsibility model would be required before a stricter guard — deferred, Owner-accepted |
| DEC-016 backend | `TECHNICAL EXECUTION COMPLETE — INDEPENDENT FOCUSED AUDIT CLOSED — PASS` (Fresh Codex Session B, 2026-08-29, checkpoint `6dd8d52`) |
| DEC-016 independent audit gate | CLOSED — PASS. R1 Schema/Migration, R2 Case/TreatmentPathway, R3 Investigation/Authorization, R4 Transaction/Concurrency, R5 Tenant/Provenance đều PASS; targeted 27/27 PASS; PRE-DEC016 → DEC-016 migration probe PASS; Prisma schema validation PASS; findings NONE; blockers NONE; audit changed no repository files. Verified technical verification, không phải Owner Decision mới |
| Demo Admin UI (`frontend/src/pages/admin/*`) | DEMO-oriented/view-only ở frontend. `UsersPage` chưa có user-lifecycle write API. Backend Facility/Room có write API hiện hữu; DEC-017 không thay đổi authorization semantics của các API đó |
| AppSidebar.tsx nav v1 | OWNER LOCKED (DEC-017) |
| DEC-018 status | **CLOSED — OWNER ACCEPTED (2026-08-30)**. OWNER LOCKED 2026-08-29; external review CLOSED — PASS; Contract v0.2; T0→T8 complete |
| Next gate | **ChatGPT direct review of corrected B-GOV diff → Owner decision → Owner separately authorizes one governance-only commit/push → actual resulting commit SHA becomes `B_GOV_SHA` → working tree/branch verified clean → Package B T0.** Package A remains OWNER CLOSED; no further A audit/review loop; residual P2 NON-BLOCKING / DEFERRED. DEC-019 has no pending gate (T7/T8 WAIVED BY OWNER — NOT EXECUTED) |
| Session A role | Implementation executor; không phải independent auditor |
| M0 | Disposable synthetic PRE backup/hash → migrate → explicit reconciliation → actual destroy/restore PRE → deterministic reapply PASS; repeatable from immutable baseline Git |
| Migration | Additive `20260828000000_dec016_case_pathway_investigation`; 11 migrations, none pending; DEC-015 immutable |
| Backend | Full E2E 354/354 (20 suites); unit 80/80 (9 suites) |
| Frontend | 59/59 (15 test files); build/typecheck PASS |
| Browser | 9/9 PASS |
| Backup/restore | PASS; all-table canonical row signatures including AuditEvent and migration metadata match; full post-restore E2E 354/354 |
| Pre-existing baseline note (reviewed by Session B) | Extra schema parity check chỉ báo FK roomId baseline RESTRICT/default mismatch có từ HEAD gốc; không do DEC-016. Fresh Codex Session B audit trên `6dd8d52`: findings NONE, blockers NONE. Không tự sửa legacy migration |
| Privacy / diff | Change-set synthetic/privacy review PASS; git diff --check PASS |
| Case | CareEpisode = physical storage; Initial creates/reuses Case, Return never creates Case |
| Longo | Child SURGERY/LONGO TreatmentPathway; explicit methodCode, no backend default; exact pathway/timepoint task matching |
| Treatment Decision | Same key v2 multimodal; existing v1 preserved; no auto pathway creation |
| Investigation / NURSE | Explicit parent, raw Result, prior without local Order; NURSE assigned workflow only |
| Owner product acceptance | NOT CLAIMED; synthetic Run2-shape test không thay Owner Run2 evidence |
| CORE-05 | `CASE INTELLIGENCE — NOT OPENED` |
| System Admin (identity realm `SystemAdminUser`, `/system-admin/*`) | `OUT OF SCOPE` — deferred per DEC-018; not implemented |
| Implementation/test data | `SYNTHETIC DATA ONLY` |
| Real-patient runtime / production | `NOT AUTHORIZED` |
| AI / PDF-image attachments | `DEFERRED / OUT OF SCOPE` |

Mọi checkpoint/acceptance trước DEC-016 trong các section trên là lịch sử. DEC-016 chỉ thay các quy tắc được Owner mở rõ ràng; clinical definitions deferred và quyền Owner acceptance không đổi. Current branch là nguồn work-in-progress; không suy luận trạng thái này từ main.
