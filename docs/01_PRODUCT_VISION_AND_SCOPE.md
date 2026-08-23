# GastroCare — Product Vision & Scope

Cập nhật: 2026-08-21

> **Ghi chú trạng thái hiện hành (23/08/2026):** Foundation, Technical Foundation, CORE-01, CORE-02 và CORE-03 / Technical Core đã `CLOSED`. GastroCare Core tổng thể đang `IN PROGRESS`. Longo Clinical Workflow v1.0 đã `OWNER LOCKED`; triển khai Real-world Clinical Core chưa bắt đầu và real-patient runtime chưa được phép. Xem [`PROJECT_STATE.md`](PROJECT_STATE.md) và [`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md). A-001 về chuyên khoa đầu tiên vẫn là Working Assumption (giả định đang làm việc), chưa phải Owner Decision.

## Câu hỏi tài liệu này trả lời

Chúng ta đang xây cái gì, và không xây cái gì?

## Vì sao sản phẩm tồn tại

**Working Product Hypothesis:** bác sĩ chuyên khoa tư nhân hiện được giả định đang quản lý bệnh nhân qua giấy, đơn thuốc, Zalo cá nhân và trí nhớ — chưa xác minh bằng quan sát thật với BS Thái. Giá trị GastroCare tạo ra không phải "phần mềm đẹp hơn" — mà là đảm bảo một bệnh nhân cần theo dõi không biến mất khỏi tầm nhìn của bác sĩ sau khi rời phòng khám.

## Product Core

```
Patient
   ↓
Encounter
   ↓
Clinical Information (ClinicalNote, Assessment)
   ↓
CarePlan
   ↓
Follow-up
   ↓
CareTask
   ↓
Return Encounter
   ↓
Patient Timeline (projection, không phải nguồn dữ liệu thứ hai)
```

## Vì sao tiêu hóa trước

*(Xem `DECISION_LOG.md` A-001 — đây là ASSUMPTION kế thừa từ nền tảng dự án trước, chưa được Owner xác nhận lại trong luồng thảo luận Core-first hiện tại. Lý do dưới đây là rationale đề xuất, không phải quyết định đã khóa.)*

- Nhiều bệnh lý tiêu hóa có lộ trình follow-up rõ ràng (viêm loét, HP, polyp, GERD).
- Cấu trúc thông tin một lượt khám tương đối nhất quán: triệu chứng → chỉ định → đánh giá → điều trị → tái khám.
- Có sẵn quan hệ với một bác sĩ chuyên khoa (BS Thái) sẵn sàng làm pilot user.

## Vì sao Core được xây trước AI

Xem P-01, P-02 trong `02_PRODUCT_PRINCIPLES.md`. Tóm tắt: nếu sản phẩm chỉ có giá trị khi có AI, đó là AI wrapper, không phải sản phẩm y tế. GastroCare phải hữu ích với BS Thái ngay cả khi nhập liệu hoàn toàn thủ công.

## Anti-Scope (phạm vi loại trừ)

Core ban đầu **không phải**:

- HIS (hệ thống thông tin bệnh viện)
- Full EMR (hồ sơ bệnh án điện tử đầy đủ)
- AI Doctor / AI diagnosis / AI prescription
- Generic CRM / chatbot chung
- Research OS
- Native mobile application bắt buộc
- Multi-specialty ngay lập tức
- Billing system phức tạp / insurance platform
- Hospital integration toàn diện

Đây là cơ chế chống scope creep — mọi đề xuất tính năng mới phải đối chiếu với danh sách này trước khi đưa vào roadmap.
