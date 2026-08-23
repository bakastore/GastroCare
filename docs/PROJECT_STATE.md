# GastroCare — Trạng thái dự án

**Cập nhật:** 23/08/2026

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
| Real-world Clinical Core implementation (triển khai lõi lâm sàng theo thực tế) | NOT STARTED |
| Owner Synthetic Clinical Acceptance | Chưa thực hiện; chỉ xác nhận mức sẵn sàng triển khai Clinical Core, không đóng GastroCare Core |
| AUTHORIZED REAL-WORLD PILOT ACCEPTANCE | FUTURE GATE — chưa được phép mở |
| Continuous Care (chăm sóc liên tục) | NOT COMPLETE |
| Product Refinement / UI-UX (tinh chỉnh sản phẩm/giao diện-trải nghiệm) | DEFERRED đến khi Clinical Core được chấp nhận |
| AI Value-Added Layer | DEFERRED |

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
Implementation status: NOT STARTED
Real-patient runtime: NOT AUTHORIZED
```

## 5. Giai đoạn và work package tiếp theo

**Giai đoạn hiện tại:** GASTROCARE CORE — IN PROGRESS

**Giai đoạn tiếp theo:** REAL-WORLD CLINICAL CORE IMPLEMENTATION

**Dữ liệu dùng để triển khai/kiểm thử/chấp nhận hiện tại:** chỉ dùng synthetic data (dữ liệu giả lập) — REQUIRED

Clinical Core tiếp theo phải triển khai theo SSOT Longo v1.0 và vượt các acceptance gate (cổng chấp nhận) đã khóa trước khi Product Refinement/UI-UX bắt đầu.

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
| Current task | `Create and Owner-review docs/09_CORE04_IMPLEMENTATION_CONTRACT.md` |
| Implementation status | `NOT STARTED` |
| Next execution gate | `CORE-04 Implementation Contract → Owner approval → T0 Baseline Verification` |
| Real-patient runtime | `NOT AUTHORIZED` |
| Implementation/test data | `SYNTHETIC DATA ONLY` |
| Full UI/UX redesign | `DEFERRED until Clinical Core acceptance` |
| AI | `DEFERRED` |

`CURRENT EXECUTION CONTEXT` là trạng thái vận hành, không phải hồ sơ lịch sử. Cập nhật section này mỗi khi một accepted checkpoint (điểm kiểm soát đã được chấp nhận) làm thay đổi branch, current task, next gate hoặc implementation status.

Không âm thầm sửa đổi Owner Decisions khi cập nhật section này.
