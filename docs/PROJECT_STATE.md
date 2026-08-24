# GastroCare — Trạng thái dự án

**Cập nhật:** 24/08/2026 — CORE-04 checkpoint independently verified after T16 remediation; Longo-only Gate G retired by Owner before product workflow pivot

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
| Real-world Clinical Core implementation (triển khai lõi lâm sàng theo thực tế) | T1-T4 OWNER ACCEPTED (trước) — T5-T15 IMPLEMENTED — Initial Independent T16: FAIL — T16 remediation: COMPLETED — Fresh Independent T16 re-audit: PASS — CORE-04 là independently verified technical/clinical implementation baseline cho Longo sub-branch; CORE-04 Owner product acceptance: NOT CLAIMED |
| Owner Synthetic Clinical Acceptance | Longo-only Gate G: RETIRED BY OWNER — không tiếp tục vì workflow sản phẩm đã đổi; không suy ra CORE-04 Owner product acceptance |
| AUTHORIZED REAL-WORLD PILOT ACCEPTANCE | FUTURE GATE — chưa được phép mở |
| Continuous Care (chăm sóc liên tục) | NOT COMPLETE |
| Product Refinement / UI-UX (tinh chỉnh sản phẩm/giao diện-trải nghiệm) | DEFERRED đến khi Clinical Core được chấp nhận |
| AI Value-Added Layer | DEFERRED |
| Current product direction | `HEMORRHOID REAL-WORLD CLINICAL WORKFLOW RECONCILIATION` — direction only; chưa mở work package mới |
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

## 4. SSOT quy trình Longo

[`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md) là authoritative SSOT (nguồn sự thật duy nhất có thẩm quyền) cho triển khai Longo Clinical Core theo thực tế.

```text
Status: OWNER LOCKED
Version: 1.0
Implementation status: CORE-04 TECHNICAL/CLINICAL BASELINE INDEPENDENTLY VERIFIED
Owner product acceptance: NOT CLAIMED
Real-patient runtime: NOT AUTHORIZED
```

## 5. Giai đoạn và hướng tiếp theo

**Giai đoạn hiện tại:** GASTROCARE CORE — IN PROGRESS

**Hướng sản phẩm hiện tại:** HEMORRHOID REAL-WORLD CLINICAL WORKFLOW RECONCILIATION

Đây là direction (định hướng) sau checkpoint CORE-04, chưa phải một work package mới được mở. `CORE-05` giữ nguyên là `CASE INTELLIGENCE`.

**Dữ liệu dùng để triển khai/kiểm thử/chấp nhận hiện tại:** chỉ dùng synthetic data (dữ liệu giả lập) — REQUIRED

CORE-04 Longo được giữ làm verified baseline cho sub-branch, không phải workflow sản phẩm đang được tiếp tục nghiệm thu. Mọi triển khai theo hướng Hemorrhoid mới phải chờ authority và execution context phù hợp; section này không tự mở work package.

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
| Current branch | `core/core-04-real-world-clinical-workflow` |
| Branch baseline | `161b46b9a4c4d77cf6f66bb487b9dc38b1bdfbc5` |
| Current phase | `GASTROCARE CORE — IN PROGRESS` |
| Current work package | `CORE-04 — REAL-WORLD CLINICAL WORKFLOW` |
| Current authoritative clinical SSOT | `docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md` |
| Implementation Contract | `OWNER LOCKED v0.3.1` — `docs/09_CORE04_IMPLEMENTATION_CONTRACT.md` |
| T1 status | `OWNER ACCEPTED — GATE A CLOSED` |
| T2 status | `OWNER ACCEPTED — GATE B CLOSED` |
| T3 status | `OWNER ACCEPTED — FRAMEWORK CLOSED` |
| T4 status | `OWNER ACCEPTED — PREOP FORM PASS` |
| T5-T9 status | `IMPLEMENTED` — LONGO_INTRAOP_RECORD, LONGO_EARLY_POSTOP, LONGO_TWO_WEEK_FOLLOWUP (không Wexner), ANAL_DILATION_ASSESSMENT (free text only), LONGO_LONG_TERM_FOLLOWUP (plannedTimepoint required + Wexner MONTH_1/3/6) — đủ sáu Longo form family |
| T10 status | `IMPLEMENTED` — follow-up scheduling idempotent, surgery `occurredAt` anchor, deterministic timepoint matching, không `CareTask.episodeId`, không auto-close Episode |
| T11 status | `IMPLEMENTED` — Timeline grouped theo Episode + `ungroupedEncounters`, sort theo `occurredAt`, amendment lineage đầy đủ, vẫn read projection |
| T12 status | `PASS` — migration/seed/backup-restore independently re-verified trên disposable test DB sau remediation |
| T13 status | `PASS` — backend unit 59/59, backend E2E 191/191 independently re-verified sau remediation |
| T14 status | `IMPLEMENTED` — functional frontend workflow (Episode start/close/reopen, sáu Longo forms, amendment + history, follow-up queue planned/actual, Episode-aware Timeline) |
| T15 status | `PASS` — browser E2E 5/5, hai lần liên tiếp; bao gồm clinical workflow thực tế cho Month 1/3/6 sau remediation R4 |
| T16 status | Initial Independent T16: `FAIL` (5 findings R0-R5) → T16 remediation: `COMPLETED` → Fresh Independent T16 re-audit: `PASS` |
| Current task | `Finalize CORE-04 verified checkpoint before product workflow pivot` |
| Next direction | `HEMORRHOID REAL-WORLD CLINICAL WORKFLOW RECONCILIATION` — direction only; không mở work package mới trong checkpoint này |
| Latest independently verified regression evidence (post-remediation) | Backend unit 59/59 · Backend E2E 191/191 · Frontend 20/20 + production build PASS · Browser E2E 5/5, hai lần liên tiếp (bao gồm Month 1/3/6 clinical workflow) · `prisma validate`/`migrate status` PASS (8 migrations, up to date; gồm additive migration cho `AuditEvent.seq`) · Backup/restore PASS · Privacy/secret/PII scan: PASS |
| Real-patient runtime | `NOT AUTHORIZED` |
| CORE-04 checkpoint role | Independently verified technical/clinical implementation baseline cho Longo sub-branch; `OWNER PRODUCT ACCEPTANCE: NOT CLAIMED` |
| Gate G (Owner Synthetic Clinical Acceptance) | `RETIRED BY OWNER — LONGO-ONLY GATE`; không tiếp tục vì workflow sản phẩm đã đổi |
| CORE-05 | `CASE INTELLIGENCE` — giữ nguyên; chưa mở |
| Implementation/test data | `SYNTHETIC DATA ONLY` |
| Full UI/UX | `DEFERRED` |
| AI | `DEFERRED` |

`CURRENT EXECUTION CONTEXT` là trạng thái vận hành, không phải hồ sơ lịch sử. Cập nhật section này mỗi khi một accepted checkpoint (điểm kiểm soát đã được chấp nhận) làm thay đổi branch, current task, next gate hoặc implementation status.

Không âm thầm sửa đổi Owner Decisions khi cập nhật section này.
