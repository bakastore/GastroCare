# GastroCare — Roadmap và Acceptance Gates

**Cập nhật:** 31/08/2026 — **DEC-019 Staff Profile & Credential Management v1: OWNER CLOSED** (Owner-directed governance closure 2026-08-31). Contract v0.1 remains OWNER LOCKED as historical authority; T0→T6 implementation preserved in working tree; T7 (Fresh Codex independent audit) = WAIVED BY OWNER — NOT EXECUTED; T8 (Owner Synthetic Acceptance) = WAIVED BY OWNER — NOT EXECUTED; no PASS / acceptance claim. Last closed work package = DEC-019; current work package = NONE. Baseline = DEC-018 remote checkpoint `7d33e02`. Prior: **DEC-018 Admin Boundary / User Management v1 acceptance gate CLOSED — OWNER ACCEPTED** (T0→T8; T7 independent audit completed with 1 MEDIUM finding remediated + Owner-accepted; T8 Owner Synthetic Acceptance PASS incl. T8.9 Last Clinic Admin protection); DEC-017 SSOT reconciliation; DEC-016 independent audit gate CLOSED — PASS.

Roadmap này được điều khiển bởi năng lực, không có mốc tuần/tháng cố định. Một phase (giai đoạn) chỉ hoàn thành khi acceptance gate (cổng chấp nhận) tương ứng được thỏa.

```text
FOUNDATION
→ GASTROCARE CORE
→ CONTINUOUS CARE
→ PRODUCT REFINEMENT
→ COMMERCIAL VALIDATION
→ AI VALUE-ADDED LAYER
→ FUTURE INTELLIGENT CARE
```

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| FOUNDATION | CLOSED |
| Technical Foundation | CLOSED |
| CORE-01 | CLOSED |
| CORE-02 | CLOSED |
| CORE-03 / Technical Core | CLOSED — baseline `technical-core-v0.1` |
| Real-world evidence alignment | COMPLETE |
| Clinical architecture | LOCKED |
| Longo Clinical Workflow v1.0 | OWNER LOCKED |
| Real-world Clinical Core implementation | IN PROGRESS — Hemorrhoid Vertical Slice 1 TECHNICALLY ACCEPTED; Vertical Slice 2 technical execution complete (historical); Vertical Slice 3 technical execution complete và đã MERGED vào `main` |
| Hemorrhoid Vertical Slice 1 | CLOSED — TECHNICAL ACCEPTANCE at `2ea529ee200a0a37a77cebb9a750f70adde57618` (historical) |
| Hemorrhoid Vertical Slice 2 | TECHNICAL EXECUTION COMPLETE (historical completed work package) — DEC-012 + Contract v0.1 OWNER LOCKED; Owner product acceptance NOT CLAIMED |
| Hemorrhoid Vertical Slice 3 | TECHNICAL EXECUTION COMPLETE và đã MERGED vào `main` tại `4a73a0c8764558d2776adffcf1d26092f6456634` — DEC-013 + Contract `docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md` OWNER LOCKED; Owner product acceptance NOT CLAIMED |
| Current checkpoint | DEC-016 T0→M7 technical execution complete; implementation checkpoint `6dd8d52` COMMITTED/PUSHED theo DEC-017; Fresh Codex Session B independent focused audit `CLOSED — PASS` (2026-08-29; findings NONE; blockers NONE); status `TECHNICAL EXECUTION COMPLETE — INDEPENDENT FOCUSED AUDIT CLOSED — PASS`; Owner product acceptance NOT CLAIMED. `DEC-018 — ADMIN BOUNDARY / USER MANAGEMENT v1`: **acceptance gate CLOSED — OWNER ACCEPTED (2026-08-30)**, T0→T8 complete per `docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md` v0.2 (SYNTHETIC DATA ONLY), committed at remote checkpoint `7d33e02`. `DEC-019 — STAFF PROFILE & CREDENTIAL MANAGEMENT v1`: **OWNER CLOSED (2026-08-31)** — Owner-directed governance closure; T0→T6 implementation preserved; T7/T8 WAIVED BY OWNER — NOT EXECUTED; no PASS / acceptance claim; see §3.2.5. Current work package = NONE |
| GASTROCARE CORE tổng thể | IN PROGRESS |
| CONTINUOUS CARE | NOT COMPLETE |
| PRODUCT REFINEMENT / UI-UX | NOT STARTED — bị chặn đến khi Clinical Core được chấp nhận |
| AI VALUE-ADDED LAYER | DEFERRED |

Technical Core đã đóng tại SHA `1a95f57f0b19bddbfcd817101d5c0c1135d90686`, tag `technical-core-v0.1`. Việc đã có primitive `CareTask` không đủ để đánh dấu Continuous Care hoàn tất. Việc Technical Core đã đóng cũng không đóng toàn bộ GastroCare Core.

## 2. FOUNDATION — CLOSED

**Mục tiêu:** hoàn tất Documentation Baseline được Owner review và nền kỹ thuật tối thiểu gồm xác thực, tenant isolation (cô lập tenant) và quy trình rà soát migration.

**Kết quả:**

- Gate 1 — Documentation Acceptance: CLOSED.
- Gate 2 — Technical Foundation Acceptance: CLOSED.
- Technical Foundation: CLOSED.

## 3. GASTROCARE CORE — IN PROGRESS

**Mục tiêu:** cung cấp Clinical CRM + Follow-up SaaS vận hành thủ công, không phụ thuộc AI, cho toàn bộ vòng đời chăm sóc cốt lõi.

### 3.1 Các work package/checkpoint đã đóng

- CORE-01 — Clinical Core Walking Skeleton: CLOSED.
- CORE-02 — Doctor Experience / Web UI v0.1: CLOSED.
- CORE-03 — Pilot Readiness, Operational Hardening và Technical Core: CLOSED.
- Real-world evidence alignment: COMPLETE, dựa trên kiểm toán 270/270 DOCX.
- Kiến trúc `CareEpisode`: LOCKED.
- Clinician Review: LOCKED FOR v1 SCOPE.
- Longo Clinical Workflow v1.0: OWNER LOCKED.
- CORE-04 Longo: independently verified technical/clinical baseline; Longo-only Gate G đã RETIRED BY OWNER.
- Hemorrhoid Real-World Workflow — Vertical Slice 1: TECHNICALLY ACCEPTED tại `2ea529ee200a0a37a77cebb9a750f70adde57618`.

### 3.2 Historical completed work package — Hemorrhoid Vertical Slice 2

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 IMPLEMENTATION** — `TECHNICAL EXECUTION COMPLETE` (không còn là work package hiện tại; giữ lại làm hồ sơ lịch sử).

Authority:
- DEC-012 — OWNER LOCKED;
- [`11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md`](11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md) — OWNER LOCKED.

Target:

```text
Hemorrhoid Examination
→ Diagnosis
→ Treatment Decision
→ CarePlan
→ Follow-up
→ Return Encounter
```

Discovery Gate CLOSED; unresolved Owner questions = 0.

Sequence:
`T0 → T1 Diagnosis → T2 Treatment Decision → T3 CarePlan sequence → T4 reconciliation/concurrency → mandatory focused Independent Codex T4 audit → T5 CareTask/Return Encounter → T6 Timeline/frontend → T7 targeted synthetic acceptance`.

Expected boundary: `NO PRISMA SCHEMA CHANGE / NO DATABASE MIGRATION`.
Synthetic data only. Real-patient runtime `NOT AUTHORIZED`.
Procedure/Surgery/Investigation/AI/CORE-05 không được mở.

Owner product acceptance: NOT CLAIMED.

### 3.2.1 Historical completed work package — Hemorrhoid Vertical Slice 3 (MERGED)

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 3 (CONTINUOUS CARE LOOP)** — `TECHNICAL EXECUTION COMPLETE` và đã `MERGED` vào `main` (không còn là work package hiện tại).

Authority: DEC-013 — OWNER LOCKED; [`12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md`](12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md) — OWNER LOCKED.

PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`): MERGED. Merged main baseline: `4a73a0c8764558d2776adffcf1d26092f6456634`. Final T7 implementation commit (lịch sử): `24b4abec7b932acd329d711f7cb9ca3773b204f3`.

T4/T7 gates: CLOSED — PASS (xem chi tiết tại §3.4.1 và `docs/PROJECT_STATE.md` §4.3). Schema/migration: NO CHANGE. Owner product acceptance: NOT CLAIMED.

### 3.2.2 Historical gate — Post-Slice-3 Owner Synthetic Product Acceptance

Sau khi Slice 3 đã merge vào `main`, Owner Synthetic Product Acceptance từng là current checkpoint. DEC-016 mở work package mới bên dưới; điều kiện product acceptance sau đây vẫn giữ nguyên.

**Technical PASS (build/test/audit/browser acceptance ở mọi gate T0-T7) không đồng nghĩa với Owner product acceptance.** Đây là hai khái niệm tách biệt theo authority hierarchy của roadmap này.

Gate này chỉ được đóng bằng xác nhận rõ ràng, tường minh từ Owner/BS Thái — không được tự suy ra, không được tự đóng bởi kết quả kỹ thuật, và không được Claude Code/AI tự ghi nhận PASS.

Cho đến khi Owner/BS Thái xác nhận:

- `GASTROCARE CORE` tiếp tục `IN PROGRESS` (không đóng).
- `CONTINUOUS CARE` tiếp tục `NOT COMPLETE` (không mở).
- `PRODUCT REFINEMENT` tiếp tục `DEFERRED` (không mở).
- `CORE-05` tiếp tục `NOT OPENED` (không mở).
- Real-patient runtime và production tiếp tục `NOT AUTHORIZED`.

### 3.2.3 Current package — DEC-016 Case / Pathway / Investigation

Authority: [DEC016_OWNER_AUTHORITY.md](DEC016_OWNER_AUTHORITY.md), Owner cho phép Session A thực hiện liên tục T0 → M0 schema/reconciliation proof → M1 Case → M2 TreatmentPathway/Longo → M3 Initial/Return → M4 Decision v2 → M5 Investigation → M6 workspace → M7 synthetic acceptance. Toàn bộ technical execution T0→M7 đã hoàn tất và được commit/push tại implementation checkpoint `6dd8d52` theo DEC-017.

Fresh Codex Session B independent focused read-only audit trên implementation checkpoint `6dd8d52`: **CLOSED — PASS** (2026-08-29). R1 Schema/Migration, R2 Case/TreatmentPathway, R3 Investigation/Authorization, R4 Transaction/Concurrency, R5 Tenant/Provenance — tất cả PASS; targeted DEC-016/concurrency tests 27/27 PASS; PRE-DEC016 → DEC-016 migration probe PASS; Prisma schema validation PASS; findings NONE; blockers NONE; audit không đổi file nào trong repo. Session A không phải independent audit; kết quả audit này là verified technical verification, không phải Owner Decision mới. DEC-016 technical status: `TECHNICAL EXECUTION COMPLETE — INDEPENDENT FOCUSED AUDIT CLOSED — PASS`.

### 3.2.4 DEC-018 Admin Boundary / User Management v1 — CLOSED — OWNER ACCEPTED (2026-08-30)

Authority: DEC-018 OWNER LOCKED (2026-08-29); external review CLOSED — PASS;
Contract [`docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`](14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md) v0.2.
Owner cho phép implementation liên tục T0 → T6 (Claude Code); T7 = Fresh Codex
independent focused read-only audit (không tự thực hiện); T8 = Owner Synthetic
Acceptance (Claude không tự đóng PASS). SYNTHETIC DATA ONLY; real-patient
runtime / production NOT AUTHORIZED. Scope: `AuthUser.isClinicAdmin` capability,
tenant JWT v1 (`sub` / `realm=TENANT` / `sessionVersion`), DB-backed request
authority, `/clinic-admin/*` canonical routes, last-Clinic-Admin SERIALIZABLE
invariant, Facility/Room write = Clinic Admin capability. Out of scope:
`SystemAdminUser`, `/system-admin/*`, generic permission engine, break-glass,
SSO/MFA/SCIM, CORE-05, AI. Không thay clinical semantics DEC-010→016.

Trạng thái: **T0 → T8 CLOSED — OWNER ACCEPTED (2026-08-30)**.

- T0 → T6: Claude Code implementation complete. Migration additive `20260829040958_dec018_admin_boundary_user_management` (prisma validate PASS; backup/restore verification PASS). Backend build PASS, unit 80/80, e2e 378/378. Frontend build PASS, vitest 139/139, lint clean. Browser `e2e/dec018-admin.spec.ts` PASS; 3 pre-existing browser failures unrelated to DEC-018 (components byte-identical với baseline `5a7fd67`).
- T7 Fresh Codex independent focused read-only audit: COMPLETED. 1 MEDIUM finding — disabled DOCTOR/NURSE could still be selected via `GET /investigations/assignees` and accepted via `POST /investigations/:id/orders` as a NEW assignee. Remediation: `status = ACTIVE` filter added to both paths; targeted E2E (`dec016-case-workspace.e2e-spec.ts`). Owner accepted the remediation as closing T7.
- T8 Owner Synthetic Acceptance: **PASS**. Accepted T8 corrections — reset-password one-time temporary-password handoff modal; unified mutation notification (toast) system; simplified UsersPage; create-user modal; edit-user modal. **T8.9 Last Clinic Admin protection: PASS.**
- Non-blocking UX note: Facility/Room card interaction can be made clearer in a later pass (recorded, not blocking).
- Out of scope, unchanged: `SystemAdminUser` / `/system-admin/*`, production, real-patient runtime, CORE-05.
- Next: Owner Decision / DEC-019 discovery. No work package currently open.

[Bằng chứng implementation DEC-016](13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md). Clinical Core chưa Owner product accepted; CORE-05, AI, real-patient runtime, production và PDF/image storage không mở. Giới hạn Procedure/Surgery/Investigation của package cũ không phủ quyết phạm vi DEC-016 đã được Owner khóa mới hơn.

### 3.2.5 DEC-019 Staff Profile & Credential Management v1 — OWNER LOCKED / IMPLEMENTATION AUTHORIZED (2026-08-30)

Authority: DEC-019 OWNER LOCKED (2026-08-30); Contract
[`docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`](15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md)
v0.1 OWNER LOCKED; external repo-grounded review CLOSED — PASS. Baseline =
DEC-018 CLOSED — OWNER ACCEPTED — remote checkpoint `7d33e02c36f5e862c50717c340deea86ad046e47`.

Scope: `StaffProfile` (optional 1:1 professional profile), `StaffCredential`
(license/certificate/training; derived `EXPIRED`), `EmploymentHistory` (overlap
allowed), `StaffFacilityAssignment` (multi-facility active, exactly one active
primary, no hard-delete, PostgreSQL partial unique indexes as concurrency
guard). New `/clinic-admin/users/:id/{profile,credentials,employment-history,facility-assignments,staff-audit}`
endpoints behind existing `ClinicAdminGuard`; `GET /auth/me/profile` self read;
frontend User Detail page (`/clinic-admin/users/:id`, tabs Tổng quan / Chuyên môn
/ Chứng chỉ / Công tác / Nhật ký) + self `/profile`.

Out of scope, unchanged: avatar/file upload, credential scan/PDF, object
storage, Staff Directory, `/clinicians` enrichment, roster/scheduling, payroll,
attendance/leave, employment contracts, CCCD/passport, home address, bank
account, System Admin, generic permission engine, facility-based clinical ACL,
CORE-05, AI, production, real-patient runtime. No change to clinical semantics
DEC-010→018. `AuthRole` stays exactly DOCTOR / NURSE / RECEPTIONIST — no ADMIN
role.

Execution sequence: `T0 → T1 → T2 → T3 → T4 → T5 → T6` (Claude Code, continuous)
→ `T7` Fresh Codex independent focused read-only audit (R1 migration + manual
partial indexes; R2 tenant isolation/ancestry; R3 facility lifecycle +
concurrency; R4 audit atomicity/minimization; R5 regression boundary) → `T8`
Owner Synthetic Acceptance. SYNTHETIC DATA ONLY; real-patient runtime /
production NOT AUTHORIZED; no commit/push/merge/tag without separate Owner
authorization.

Status: **OWNER CLOSED (2026-08-31)** — Owner-directed governance closure. T0→T6
implementation existed in the working tree and is preserved (schema + additive
migration + `backend/src/staff/` + frontend User Detail / self profile + tests);
no rollback. `T7` Fresh Codex independent focused read-only audit = **WAIVED BY
OWNER — NOT EXECUTED**. `T8` Owner Synthetic Acceptance = **WAIVED BY OWNER — NOT
EXECUTED**. No PASS / acceptance claim (no T7 PASS, no T8 PASS, no Owner
Synthetic Acceptance, no additional Technical Acceptance, no Product Acceptance).
No further DEC-019 work authorized. Real-patient runtime / production remain NOT
AUTHORIZED. See DECISION_LOG `DEC-019 CLOSURE`. Historical execution-sequence and
gate text below is retained as the locked Contract's original requirements.

### 3.3 Preserved Longo Clinical Core baseline

CORE-04 Longo tiếp tục là preserved verified baseline, không phải active product gate.
Longo-only Owner Synthetic Clinical Acceptance Gate G đã `RETIRED BY OWNER` theo DEC-009 và không được mở lại ngầm.

### 3.4 Hemorrhoid Vertical Slice 2 Gates

**Discovery Gate:** CLOSED — DEC-012 approved; Contract v0.1 OWNER LOCKED; unresolved Owner questions = 0.

**Implementation gates:**
1. T0 preflight PASS.
2. T1 Diagnosis PASS.
3. T2 Treatment Decision PASS.
4. T3 CarePlan sequence PASS.
5. T4 Serializable reconciliation + concurrency tests PASS.
6. ChatGPT T4 source review PASS.
7. Fresh Independent Codex READ-ONLY T4 audit: `READY FOR T4 ACCEPTANCE: YES`.
8. T5 generic CareTask + explicit Return Encounter linkage PASS.
9. T6 Timeline/frontend PASS.
10. T7 targeted synthetic acceptance PASS.

T4 independent audit là mandatory focused gate, không phải full-Slice audit.
Nếu T4 production code thay đổi sau PASS, T4 independent gate mở lại cho affected delta.
Nếu cần schema/migration: STOP trước scope expansion.

### 3.4.1 Hemorrhoid Vertical Slice 3 Gates (technical execution complete, MERGED)

**Governance Gate:** T0 CLOSED — DEC-013 OWNER LOCKED; Contract v0.1 OWNER LOCKED.

**Implementation gates:** T1 (templates/ancestry/sequence) PASS; T2 (atomic Return Encounter orchestration) PASS; T3 (two-branch CarePlan enforcement + continuous loop) PASS; T4 (episode lifecycle/concurrency, C1-C4 real-PostgreSQL) `CLOSED — PASS`, fresh Independent Codex READ-ONLY audit PASS; T5 (Timeline/backend integration) PASS; T6 (frontend) PASS; T7 (targeted synthetic acceptance, backend + focused Playwright browser acceptance) `CLOSED — PASS`.

**Merge:** PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`) MERGED at `4a73a0c8764558d2776adffcf1d26092f6456634`. T7 raw re-verified directly on merged main: targeted 3/3 PASS, backend 331/331 PASS, frontend 37/37 PASS, builds PASS, worktree CLEAN, blockers NONE.

Slice 3 technical execution complete và merge sequence hoàn tất không tự động đóng `OWNER SYNTHETIC PRODUCT ACCEPTANCE` (§3.2.2) — hai gate này tách biệt.

### 3.5 AUTHORIZED REAL-WORLD PILOT ACCEPTANCE — FUTURE GATE

Gate này chỉ được mở sau khi đồng thời thỏa các điều kiện:
- real-patient runtime được Owner cho phép;
- các yêu cầu legal/privacy cần thiết đã hoàn thành;
- hệ thống đã đạt các gate kỹ thuật và lâm sàng trước đó.

**Acceptance criterion (tiêu chí chấp nhận):** BS Thái hoàn thành ít nhất một chu kỳ thực tế trong GastroCare mà không phải fallback (quay lại sử dụng) giấy/Zalo cho luồng cốt lõi:

```text
Patient
→ Encounter/clinical workflow
→ follow-up
→ return visit
```

Cho đến khi gate này được Owner chấp nhận:

```text
GASTROCARE CORE = IN PROGRESS
```

Technical Acceptance hoặc Synthetic Clinical Acceptance không phải real-world product validation và không được dùng để tự cấp quyền dùng dữ liệu bệnh nhân thật.
## 4. CONTINUOUS CARE — NOT COMPLETE

**Mục tiêu:** mở rộng từ một lượt khám sang theo dõi liên tục và chứng minh `CareEpisode` giúp giảm thời gian hoặc nhầm lẫn trong chăm sóc dài hạn.

**Điều kiện vào:** GastroCare Core đạt acceptance gate và có bằng chứng sử dụng phù hợp được phép.

**Acceptance gate:** Owner xác nhận năng lực chăm sóc liên tục tạo giá trị trong vận hành. Sự tồn tại của `CareTask`, Timeline hoặc `CareEpisode` primitive không tự thỏa gate này.

## 5. PRODUCT REFINEMENT — NOT STARTED

**Trạng thái:** DEFERRED; bị chặn đến khi Clinical Core workflow hiện hành đạt acceptance gate (cổng chấp nhận) phù hợp.

**Mục tiêu:** tinh chỉnh workflow/UI-UX dựa trên bằng chứng sử dụng và kết quả nghiệm thu Clinical Core, không làm thay đổi các quyết định lâm sàng đã Owner-lock nếu chưa có change control (kiểm soát thay đổi) phù hợp.

**Acceptance gate:** workflow và trải nghiệm được Owner chấp nhận trên cơ sở bằng chứng, với mọi thay đổi SSOT được quản trị rõ ràng.

## 6. COMMERCIAL VALIDATION — NOT STARTED

**Mục tiêu:** xác nhận GastroCare Core tạo đủ giá trị để mở rộng ngoài pilot đầu tiên.

**Điều kiện vào:** Product Refinement đạt acceptance gate.

**Acceptance gate:** có quyết định Owner rõ ràng về hướng mở rộng, số pilot tiếp theo và phạm vi chuyên khoa.

## 7. AI VALUE-ADDED LAYER — DEFERRED

AI chỉ là lớp giá trị gia tăng sau khi Core chứng minh giá trị độc lập và các yêu cầu privacy/processing được giải quyết. Core phải hoạt động đầy đủ khi tắt AI.

AI không được thay thế quyết định lâm sàng của bác sĩ hoặc trở thành phụ thuộc bắt buộc của Core.

## 8. FUTURE INTELLIGENT CARE — FUTURE OPTION

Chưa định nghĩa deliverable hoặc acceptance gate chi tiết. Đây không phải cam kết hiện tại.

## 9. Ranh giới xuyên suốt

- Không dùng dữ liệu bệnh nhân thật cho runtime, triển khai, kiểm thử hoặc nghiệm thu khi chưa được Owner cấp phép rõ ràng và chưa vượt các gate an toàn/pháp lý liên quan.
- Historical import nằm ngoài work package hiện tại.
- Không biến định nghĩa lâm sàng chưa giải quyết thành dữ kiện: chấm điểm nong hậu môn đầy đủ, HDSS, SHS-HD, tương đương trường sau vô cảm và các mục độ khó Longo vẫn giữ trạng thái hoãn theo SSOT.
- Research-extension fields (trường mở rộng nghiên cứu) được tính đến nhưng không thuộc quy trình lâm sàng thường ngày mặc định.
- Không đưa AI Scribe, AI diagnosis, AI prescription, patient AI chatbot, full HIS, full EMR, Research OS, advanced analytics, complex billing hoặc mở rộng đa chuyên khoa vào Core nếu chưa có quyết định Owner tương ứng.

## 10. Kiểm soát thay đổi

Thứ bậc thẩm quyền:

```text
Quyết định Owner rõ ràng mới nhất
> Quyết định Owner trước đó
> Trạng thái dự án đã xác minh
> Baseline đã phê duyệt
> Giả định đang làm việc
> Khuyến nghị của AI
```

Mọi thay đổi đối với Longo Clinical Workflow v1.0 phải tuân theo mục Change Control của SSOT. Không tài liệu roadmap nào được làm yếu, diễn giải lại hoặc tự mở lại quyết định Owner đã khóa.
