# GastroCare — Decision Log

Cập nhật: 2026-08-23

Đây là Decision Log hiện hành và là nguồn chuẩn cho Owner Decisions
và Working Assumptions của GastroCare.

---

## OWNER DECISIONS

| ID | Quyết định | Ngày | Rationale |
|---|---|---|---|
| DEC-001 | Pilot đầu tiên với BS Thái sử dụng manual entry only; không phụ thuộc AI. | 2026-08-21 | Tách kiểm chứng workflow khỏi rủi ro chất lượng AI. |
| DEC-002 | AI là Future Value-Added Layer; AI không định nghĩa hoặc quyết định Core architecture. | 2026-08-21 | Core phải tạo giá trị độc lập với AI. |
| DEC-003 | Owner chấp nhận runway khoảng 1 năm nếu cần để ưu tiên kiến trúc và chất lượng; đây không phải deadline hoặc time-box cố định. | 2026-08-21 | Tránh tối ưu tốc độ ngắn hạn dẫn đến chi phí kiến trúc lớn về sau. |
| DEC-004 | BS Thái là first pilot user. | 2026-08-21 | Pilot thực tế đầu tiên của GastroCare. |
| DEC-005 | Documentation Baseline v1.0 phải hoàn tất và được Owner review trước khi technical implementation bắt đầu. | 2026-08-21 | Có SSOT rõ ràng trước khi AI-assisted implementation bắt đầu. |

### DEC-006 — Longo Clinical Workflow v1.0

**Ngày:** 2026-08-23

**Trạng thái:** OWNER LOCKED

**Nguồn chuẩn:** [`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md)

Owner khóa các quyết định sau cho phạm vi v1:

1. `CareEpisode` là thực thể tối thiểu được phê duyệt để nhóm một đợt điều trị; vòng đời gồm `ACTIVE` và `CLOSED`, với thao tác bắt đầu, đóng và mở lại rõ ràng. Mở lại bắt buộc có lý do và `AuditEvent`. Không tự động đóng Episode.
2. `Encounter.episodeId` nullable (cho phép rỗng) ở Core schema, nhưng application validation (xác thực ở tầng ứng dụng) của quy trình Longo bắt buộc phải có giá trị.
3. `Encounter.occurredAt` là thời điểm sự kiện lâm sàng thực sự xảy ra. Với Encounter phẫu thuật Longo, đây là mốc tính thời gian hậu phẫu.
4. `ClinicalFormSubmission` chỉ liên kết với `Encounter`. Không nhân bản `episodeId` vào `ClinicalFormSubmission`, `CarePlan` hoặc `CareTask` trong v1.
5. Clinical Form đã `COMPLETED` phải bất biến; mọi sửa đổi dùng append-only amendment lineage (chuỗi sửa đổi chỉ ghi nối tiếp), không ghi đè âm thầm.
6. Sáu họ biểu mẫu Longo được phê duyệt: `LONGO_PREOP_ASSESSMENT`, `LONGO_INTRAOP_RECORD`, `LONGO_EARLY_POSTOP`, `LONGO_TWO_WEEK_FOLLOWUP`, `ANAL_DILATION_ASSESSMENT` và `LONGO_LONG_TERM_FOLLOWUP`.
7. Các mốc tháng 1, 3 và 6 dùng chung một template `LONGO_LONG_TERM_FOLLOWUP`.
8. Nong hậu môn là sự kiện có thể lặp lại; mỗi lần là một clinical occurrence (lần xảy ra lâm sàng) riêng biệt.
9. Mô hình Wexner cho dữ liệu thu thập mới gồm 5 mục và tổng điểm xác định 0–20. Dữ liệu lịch sử thực tế của Wexner, HDSS và SHS-HD đều là `UNDETERMINED`.
10. Triển khai thường quy cuối cùng cho HDSS và SHS-HD được hoãn đến khi có xác nhận lâm sàng. Các trường research extension (mở rộng nghiên cứu) vẫn được tính đến nhưng nằm ngoài quy trình lâm sàng thường ngày mặc định.
11. Sinh `CareTask` theo dõi sau phẫu thuật phải idempotent (chạy lặp không tạo bản ghi trùng).
12. Timeline tiếp tục là read projection (hình chiếu chỉ đọc), không phải nguồn dữ liệu độc lập.
13. Historical import (nhập dữ liệu lịch sử) nằm ngoài phạm vi triển khai hiện tại.
14. Real-patient runtime (môi trường chạy với bệnh nhân thật) chưa được phép. Triển khai, kiểm thử và nghiệm thu hiện tại chỉ dùng synthetic data (dữ liệu giả lập); bằng chứng từ corpus thực tế chỉ được sử dụng dưới dạng bằng chứng/kết quả tổng hợp đã được khử thông tin nhận dạng.

**Căn cứ:** quyết định Owner/clinician; kiểm toán toàn bộ 270/270 DOCX; Atomic Field Dictionary 118/118 khái niệm đã được tính đến, 0 unmapped; kiểm tra hẹp việc thu thập Wexner/HDSS/SHS-HD.

Các định nghĩa vẫn hoãn, không được suy diễn thành dữ kiện: chấm điểm nong hậu môn đầy đủ; cách chấm HDSS; cách chấm SHS-HD; tương đương trường sau vô cảm chưa giải quyết; định nghĩa các mục độ khó Longo; triển khai nhập dữ liệu lịch sử.

---

## WORKING ASSUMPTIONS

| ID | Nội dung | Nguồn gốc | Trạng thái |
|---|---|---|---|
| A-001 | Chuyên khoa đầu tiên: tiêu hóa (gastroenterology). | Working Product Hypothesis từ giai đoạn thiết kế ban đầu. | ACTIVE — chưa Owner-confirmed. |
| A-002 | BS Thái có thể đóng vai trò Design Partner ngoài vai trò first pilot user. | AI recommendation / product working hypothesis. | ACTIVE — chưa Owner-confirmed. |

---

## RECLASSIFIED / MOVED TO NORMATIVE HOME

- A-003 — Domain model candidate được quản lý tại
  `04_CORE_DOMAIN_MODEL.md`.

- A-004 — Patient identity/matching invariant được quản lý tại
  `04_CORE_DOMAIN_MODEL.md` và `05_ARCHITECTURE_BASELINE.md`.

Các mục trên không bị hủy; chúng chỉ không còn thuộc Decision Log.

---

## SUPERSEDED

None.

---

Nguyên tắc:
- Chỉ Owner có thể tạo Owner Decision.
- Không tự nâng Working Assumption thành Owner Decision.
- Technical/domain invariants phải nằm tại normative home tương ứng,
  không dùng Decision Log làm task tracker hoặc design specification.
