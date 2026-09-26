# GastroCare — Trạng thái dự án

> File này **chỉ là con trỏ hiện tại** (current pointer): thay thế tại chỗ, không lưu
> lịch sử, không ghi chú `SUPERSEDED`. Lịch sử và quyết định nằm ở
> [`DECISION_LOG.md`](DECISION_LOG.md) (append-only). Quy tắc: `AGENTS.md` §J / [[DEC-024]].
> Bản đầy đủ trước khi rút gọn (512 dòng): `git show 200667e:docs/PROJECT_STATE.md`.
>
> **Cập nhật lần cuối:** 2026-09-26 — [[DEC-024]].

Thứ bậc thẩm quyền: Quyết định Owner mới nhất > Quyết định Owner trước đó >
Trạng thái đã xác minh > Baseline đã phê duyệt > Working Assumption > Khuyến nghị AI.

## 1. Trạng thái tổng thể

| Hạng mục | Trạng thái |
|---|---|
| Foundation / Technical Foundation / CORE-01 / CORE-02 / CORE-03 | CLOSED — OWNER ACCEPTED (Technical Core tag `technical-core-v0.1`) |
| GastroCare Core | IN PROGRESS |
| Hướng sản phẩm | HEMORRHOID REAL-WORLD CLINICAL WORKFLOW |
| Hemorrhoid Slice 1 → 3, DEC-016 → DEC-019 | Đã hoàn tất theo các record tương ứng trong DECISION_LOG |
| DEC-020 Package A | OWNER CLOSED — `A_CLOSED_SHA` `0c865a2`; residual P2 Unicode reason-length parity DEFERRED |
| DEC-021 Package R | R0→R9 PASS — CLOSED (commit `8943870`, đã có trong `main`); R10 Owner Synthetic Acceptance **DEFERRED BY OWNER** (chờ Package B/C + UI/UX rebuild) — [[DEC-022]] |
| DEC-020 Package B v0.3 | **IMPLEMENTATION AUTHORIZED** — [[DEC-024]] |
| Package C | NOT ACTIVE — chưa có Contract |
| Longo-only Gate G | RETIRED BY OWNER |
| Continuous Care | NOT COMPLETE |
| Product Refinement / UI-UX | DEFERRED |
| CORE-05 Case Intelligence | NOT OPENED |
| AI Value-Added Layer | DEFERRED |
| Owner product acceptance | NOT CLAIMED cho bất kỳ slice/package nào |

## 2. Ranh giới an toàn

| Hạng mục | Trạng thái |
|---|---|
| Implementation / test / acceptance data | `SYNTHETIC DATA ONLY` |
| Real-patient runtime / dữ liệu thật | NOT AUTHORIZED |
| Production | NOT AUTHORIZED |
| Pilot chính thức với BS Thái | NOT STARTED |
| Legal / privacy review | OPEN / REQUIRED |
| Historical import | OUT OF CURRENT SCOPE |
| Wexner / HDSS / SHS-HD historical capture | UNDETERMINED — không suy diễn |

## 3. SSOT hiện hành

| Phạm vi | Tài liệu | Trạng thái |
|---|---|---|
| Clinical workflow Hemorrhoid (rebaseline) | `docs/DEC-021_HEMORRHOID_CLINICAL_WORKFLOW_SELECTIVE_REBASELINE.md` | OWNER LOCKED v0.3 |
| Clinical workflow Hemorrhoid (gốc) | `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md` | OWNER LOCKED v1.0 |
| Clinical workflow Longo | `docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md` | OWNER LOCKED v1.0 |
| Package B hiện hành | `docs/DEC-020_PACKAGE_B_POST_T0_IMPLEMENTATION_CONTRACT_v0.3.md` | OWNER LOCKED (sửa 2026-09-26, D1–D4) |
| Package B scope ngoài OD-B01→B06 | `docs/DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md` | Historical authority — không triển khai trong package này |
| Domain / architecture / safety | `docs/04_CORE_DOMAIN_MODEL.md`, `docs/05_ARCHITECTURE_BASELINE.md`, `docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md` | Baseline |

## 4. CURRENT EXECUTION CONTEXT

| Thuộc tính | Giá trị |
|---|---|
| Current work package | DEC-020 Package B v0.3 Post-T0 — OD-B01→OD-B06 |
| Implementation Contract | `docs/DEC-020_PACKAGE_B_POST_T0_IMPLEMENTATION_CONTRACT_v0.3.md` |
| Authorization | `OWNER LOCKED + PACKAGE B v0.3 IMPLEMENTATION AUTHORIZED` — [[DEC-024]] (2026-09-26) |
| `PACKAGE_B_IMPLEMENTATION_BASE_SHA` | `200667e1bbd4f6b0d2d2970a69605ca7fe5083eb` (merge PR #17 vào `main`) |
| Current branch | `implementation/dec-020-package-b-v03` — tạo từ `main` sau khi PR lean-governance (DEC-024) được merge; delta so với base SHA chỉ là docs |
| Implementation status | NOT STARTED — bước kế tiếp là T1 |
| Thứ tự | Contract §19: T1 Vitals → T2 Diagnosis v2 → T3 Longo sequential + legacy cutover → T4 LTFU schema/contact attempt → T5 Atomic LTFU confirmation → T6 Frontend → T7 regression/concurrency → source review → independent audit (1 lần) → Owner review |
| Schema change được phép | Chỉ `CareTaskContactAttempt.qualifyingFailed Boolean?` + `INDEX (tenantId, careTaskId, attemptedAt)` — Contract §16 |
| Data | `SYNTHETIC DATA ONLY` |
| Commit / push | Được phép trên implementation branch, trong phạm vi Contract. Merge vào `main` cần Owner |
| Cập nhật file này khi | Package B đóng, có Owner Decision mới, hoặc có blocker. Tiến độ T1…T7 ghi ở commit message / PR, không ghi ở đây |
