# GastroCare — Product Principles

Cập nhật: 2026-08-21

Đây là "hiến pháp" sản phẩm (normative product constitution) — mọi tài liệu, thiết kế, và quyết định kỹ thuật khác trong Documentation Baseline phải nhất quán với các nguyên tắc dưới đây. Khi có mâu thuẫn, xem Authority Hierarchy ở cuối file.

## P-01 — Core phải có giá trị mà không cần AI

GastroCare Core phải hữu ích với BS Thái ngay cả khi nhập liệu hoàn toàn thủ công, không có bất kỳ tính năng AI nào. Nếu sản phẩm chỉ có giá trị khi có AI, đó là AI wrapper, không phải sản phẩm y tế.

## P-02 — AI nâng cao sản phẩm; AI không định nghĩa sản phẩm

AI là FUTURE VALUE-ADDED LAYER, được thêm sau khi Core đã chứng minh giá trị độc lập. AI không phải dependency của GastroCare Core, và không được quyết định kiến trúc lõi (xem [DECISION_LOG.md](DECISION_LOG.md) DEC-002).

## P-03 — Workflow tạo ra dữ liệu; dữ liệu tạo ra trí tuệ

Giá trị AI trong tương lai (nếu có) phải xây trên dữ liệu có cấu trúc được tạo ra từ workflow lâm sàng thật, không phải ngược lại. Không thiết kế workflow chỉ để phục vụ một tính năng AI giả định.

## P-04 — Có cấu trúc khi cần thiết, đơn giản khi đủ dùng

Chỉ đưa dữ liệu vào structured field khi biết rõ: ai tạo, lúc nào, vì sao, và ai sẽ dùng lại. Không structure hóa "phòng khi cần sau này" — xem P-09.

## P-05 — Độ phức tạp lâm sàng/domain nằm ở hệ thống, không đẩy sang UI bác sĩ

Bác sĩ không phải quản lý thủ công các khái niệm hệ thống (vd CareEpisode, CareTask) trừ khi có lý do lâm sàng rõ ràng. Hệ thống chịu trách nhiệm tự động hóa các việc có logic xác định.

## P-06 — Build → Observe → Correct

Giả thuyết sản phẩm (working product hypothesis) chỉ được xác nhận bằng quan sát thật khi BS Thái dùng sản phẩm, không phải bằng suy luận trước. Tài liệu hiện tại phản ánh giả thuyết làm việc, không phải sự thật đã kiểm chứng, cho đến khi có bằng chứng từ Discovery thật.

## P-07 — An toàn lâm sàng vượt trên tự động hóa

Bất kỳ tự động hóa nào (kể cả automation không-AI) có thể ảnh hưởng đến quyết định lâm sàng đều phải có đường ra an toàn (safe fallback) và không được che giấu hoặc thay thế phán đoán của bác sĩ. Automation phục vụ bác sĩ, không thay bác sĩ quyết định.

## P-08 — Documentation phục vụ execution

Tài liệu tồn tại để một người (hoặc AI agent) có thể bootstrap kỹ thuật chính xác từ đó, không phải để trông đầy đủ. Không viết tài liệu chỉ để có tài liệu.

## P-09 — Đóng băng invariant, không đóng băng từng field hay chi tiết UX

Ở giai đoạn Documentation Baseline, chỉ khóa các bất biến kiến trúc/domain (identity, lifecycle, integrity). Các chi tiết như ngưỡng thời gian cụ thể, field UI, hay copy text được để ngỏ cho đến khi có dữ liệu thật.

## P-10 — Một nguồn sự thật duy nhất (One Source of Truth)

Mỗi loại thông tin có đúng một tài liệu chuẩn (normative home). Không lặp lại nội dung chi tiết ở nhiều nơi — tài liệu khác chỉ được tham chiếu (cross-reference), không sao chép. Khi một bản tài liệu cũ bị thay thế, phải nêu rõ trong SUPERSEDED.

---

## Authority / Conflict Resolution Hierarchy

Khi các nguồn mâu thuẫn nhau, áp dụng đúng thứ tự ưu tiên sau:

```
Newest explicit Owner Decision
        >
Previous Owner Decision
        >
Verified Repository / Project State
        >
Approved Baseline
        >
Working Assumption
        >
AI Recommendation
```

Quy tắc bắt buộc:

- Không bao giờ tự động nâng một AI Recommendation hoặc Working Assumption thành Owner Decision. Chỉ Owner phát biểu trực tiếp mới tạo ra Owner Decision (xem [DECISION_LOG.md](DECISION_LOG.md)).
- Verified Repository / Project State (thực trạng repo — xem [PROJECT_STATE.md](PROJECT_STATE.md)) luôn override wording cũ trong bất kỳ tài liệu draft nào nếu có mâu thuẫn về sự tồn tại của code/schema/hạ tầng.
- Mỗi assertion quan trọng trong bộ tài liệu nên được gắn nhãn rõ một trong các loại: FACT, OWNER DECISION, APPROVED BASELINE, WORKING ASSUMPTION, FUTURE OPTION, hoặc UNKNOWN / OPEN ITEM.
