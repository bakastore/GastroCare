# GastroCare — Decision Log

Cập nhật: 2026-08-21

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
