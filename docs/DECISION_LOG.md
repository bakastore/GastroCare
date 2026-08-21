# GastroCare — Decision Log

Cập nhật: 2026-08-21
**Thay thế bản `/mnt/user-data/outputs/DECISION_LOG.md` trước đó — đây là bản hợp nhất, duy nhất còn hiệu lực (P-10).**

---

## OWNER DECISION (Owner đã phát biểu trực tiếp)

| ID | Quyết định | Ngày | Rationale |
|---|---|---|---|
| DEC-001 | Pilot đầu tiên với BS Thái: manual entry only, không AI | 2026-08-21 | Cô lập rủi ro workflow khỏi rủi ro chất lượng AI |
| DEC-002 | AI = Value-Added Layer, dài hạn, không quyết định kiến trúc lõi | 2026-08-21 | Đi kèm DEC-001 |
| DEC-003 | Owner sẵn sàng đầu tư runway đủ dài (~1 năm) để ưu tiên kiến trúc đúng hơn tốc độ triển khai vội — đây là ngân sách/mức chấp nhận rủi ro thời gian đã xác nhận, KHÔNG phải cam kết tiến độ cố định 12 tháng (không mâu thuẫn với nguyên tắc không time-box vì AI có thể làm nhanh hơn) | (trước đó, cùng phiên) | Owner phát biểu trực tiếp: "giai đoạn đầu anh sẵn sàng bỏ ra 1 năm để hoàn thành ứng dụng" |
| DEC-004 | BS Thái = first pilot user | 2026-08-21 | Owner phát biểu trực tiếp: "trong thử nghiệm ứng dụng bác sĩ Thái sẽ sử dụng thủ công" |
| DEC-005 | Tạm dừng implementation, tập trung 100% hợp nhất Documentation Baseline v1.0 trước | 2026-08-21 | Owner xác nhận trực tiếp qua câu hỏi trắc nghiệm rõ ràng ("Trong lúc hợp nhất 10 file tài liệu, anh muốn xử lý phần schema/Claude Code thế nào?"), chọn đúng phương án "Dừng hẳn code, tập trung 100% vào tài liệu trước" — bằng chứng trực tiếp, không phải suy diễn từ ngôn ngữ mơ hồ |

## ASSUMPTION (kế thừa hoặc đề xuất — CHƯA được Owner xác nhận trực tiếp)

| ID | Nội dung | Nguồn gốc | Cần xác nhận trước khi khóa? |
|---|---|---|---|
| A-001 | Chuyên khoa đầu tiên: tiêu hóa (gastroenterology) | Nền tảng GastroCare v0.1 trước đây | Nên hỏi lại — chưa từng được xác nhận trong luồng Core-first hiện tại |
| A-002 | BS Thái đóng vai trò "Design Partner" (không chỉ pilot user) | Đề xuất lặp lại nhiều lần bởi GPT | Có — đây là diễn giải vai trò, khác với DEC-004 (chỉ xác nhận BS Thái = pilot user) |
| A-003 | Domain model candidate: Patient / CareEpisode / Encounter / ClinicalNote / CarePlan / CareTask / AuditEvent | Đề xuất kỹ thuật qua nhiều vòng review Claude/GPT | Không cần Owner duyệt từng entity — đây thuộc phạm vi kỹ thuật trong ranh giới Owner đã đặt (P-04, P-09); chỉ cần Owner biết là candidate, chưa final |
| A-004 | Patient matching: dùng tên + năm sinh + SĐT làm matching signal, KHÔNG làm identity; không tự động merge hồ sơ nghi trùng | Đề xuất kỹ thuật (Claude + GPT, đã thống nhất) | Không cần — là technical invariant trong ranh giới kỹ thuật |

## SUPERSEDED

Không có mục nào bị thay thế tính đến thời điểm này.

---

*Nguyên tắc cập nhật file này: chỉ thêm dòng mới khi có DECISION hoặc ASSUMPTION mới thật sự phát sinh. Không tự động nâng ASSUMPTION lên DECISION — xem Conflict Resolution Hierarchy tại `02_PRODUCT_PRINCIPLES.md`.*
