# GastroCare — Core Domain Model

Cập nhật: 2026-08-21

Đây là tài liệu domain (miền nghiệp vụ), **không phải Prisma schema**. Không có Prisma schema, database, hay backend nào tồn tại trong repository hiện tại (xem `PROJECT_STATE.md`). Toàn bộ nội dung dưới đây là DOMAIN CANDIDATE — thiết kế đề xuất cho implementation tương lai, chưa phải APPROVED BASELINE cho từng chi tiết trừ khi nêu rõ.

## Sơ đồ domain

```
Tenant
 │
 └── Patient
       │
       ├── CareEpisode  (backend-only ở v0.1, không hiện UI — P-05)
       │      │
       │      └── Encounter
       │              ├── ClinicalNote (khái niệm — v0.1 hiện thân là field trong Encounter)
       │              └── CarePlan
       │                      └── CareTask
       │
       └── Patient Timeline (projection — không phải bảng riêng, không phải nguồn dữ liệu thứ hai)

AuditEvent — append-only, cắt ngang mọi entity
```

---

## Patient

- **Purpose:** đại diện một con người thật, là gốc của mọi dữ liệu lâm sàng.
- **Identity:** `Patient.id` — internal identifier bất biến (immutable), sinh tự động, KHÔNG BAO GIỜ đổi.
- **Matching signals (không phải identity):** fullName + yearOfBirth/dateOfBirth + phone. Dùng để cảnh báo khả năng trùng khi tạo mới, không dùng để tự động gộp.
- **Invariant:** GastroCare KHÔNG tự động merge hồ sơ bệnh nhân chỉ dựa trên heuristic matching. Khi phát hiện khả năng trùng, hệ thống cảnh báo, người dùng chọn mở hồ sơ cũ hoặc tạo mới rõ ràng.
- **Creator:** lễ tân hoặc bác sĩ, tại thời điểm đăng ký.
- **Lifecycle:** tạo một lần, cập nhật thông tin liên hệ khi cần, không bao giờ xóa (chỉ có thể archive nếu sau này cần).
- **Downstream use:** mọi Encounter, CareEpisode, CareTask đều tham chiếu Patient.
- **Cố tình chưa model:** bảo hiểm y tế, nghề nghiệp, địa chỉ chi tiết (NOISE v0.1, xem `03_CLINICAL_WORKFLOW_BASELINE.md`).

## CareEpisode

- **Purpose:** gom nhóm các Encounter/CarePlan liên quan thành một "câu chuyện chăm sóc" (vd theo dõi GERD, theo dõi polyp) — đúng nguyên tắc P-05: độ phức tạp nằm ở hệ thống, không đẩy sang UI bác sĩ.
- **Identity:** `CareEpisode.id`, thuộc về một Patient.
- **Creator:** hệ thống tự tạo/gợi ý khi Encounter đầu tiên của một vấn đề mới được lưu — KHÔNG bắt bác sĩ tự quản lý CareEpisode bằng tay ở v0.1.
- **Lifecycle:** `ACTIVE` → `CLOSED`. Đóng lâm sàng (`CLOSED`) chỉ xảy ra qua hành động tường minh của bác sĩ đánh dấu vấn đề đã giải quyết. Không có Encounter mới trong khoảng thời gian dài **không tự động đóng CareEpisode** — chỉ có thể gợi ý review (vd hiển thị trong danh sách "cần xem lại"). Ngưỡng thời gian gợi ý cụ thể: để ngỏ, xác định khi có dữ liệu thật (P-09).
- **Relationships:** 1 Patient có nhiều CareEpisode; 1 CareEpisode có nhiều Encounter.
- **Downstream use:** Patient Timeline dùng CareEpisode để nhóm hiển thị; sau này Clinical Intelligence (nếu triển khai) dùng để truy vấn theo đợt bệnh.

## Encounter

- **Purpose:** một lượt khám cụ thể, đơn vị ghi nhận chính của bác sĩ.
- **Identity:** `Encounter.id`.
- **Creator:** bác sĩ, tại thời điểm khám.
- **Lifecycle:** tạo một lần khi khám, sau khi lưu KHÔNG chỉnh sửa tự do (xem invariant Amendment bên dưới).
- **Relationships:** thuộc về 1 Patient, thuộc về 0-1 CareEpisode (backend gán), có 0-1 CarePlan.
- **Chứa (khái niệm ClinicalNote):** reason for visit, clinical note (text), assessment. Ở v0.1 (DOMAIN CANDIDATE), đây là field trực tiếp trên Encounter, KHÔNG phải bảng riêng — tách bảng riêng chỉ cần thiết khi có nhiều "phiên bản" ghi chú (vd AI draft vs bác sĩ sửa), hiện chưa cần vì DEC-001 là manual-only.
- **ClinicalNote lifecycle (tường minh):** ở v0.1, ClinicalNote KHÔNG được ký (sign) độc lập với Encounter — nó là field nội dung của Encounter, và tính bất biến/immutability chỉ được áp dụng ở mức CarePlan khi Sign (xem invariant Amendment bên dưới). Encounter/ClinicalNote sau khi lưu không có quy trình chỉnh sửa tự do ở UI, nhưng chưa có cơ chế Amendment/versioning riêng cho ClinicalNote ở v0.1 — đây là UNKNOWN / OPEN ITEM cần quyết định trước khi bootstrap kỹ thuật nếu yêu cầu lâm sàng đòi hỏi.
- **Downstream use:** Patient Timeline hiển thị theo thời gian; CareEpisode dùng để nhóm.
- **Lineage field (`source`) — DOMAIN CANDIDATE:** đề xuất mặc định `MANUAL`, để tránh migration khi mở AI sau này (P-02). Chưa tồn tại trong bất kỳ schema thật nào vì chưa có schema.

## CarePlan

- **Purpose:** cầu nối từ khám bệnh sang chăm sóc — điều trị, theo dõi, dặn dò.
- **Identity:** `CarePlan.id`, 1-1 với Encounter đã tạo ra nó.
- **Lifecycle:** `DRAFT` → `SIGNED` → (nếu cần sửa) `AMENDED`.
- **Invariant — Amendment sau khi Sign (nâng HIGH theo review):** bản ghi đã `SIGNED` KHÔNG bị ghi đè. Sửa sau khi ký tạo bản ghi mới tham chiếu bản cũ (`SIGNED v1 → AMENDMENT → SIGNED v2`), bản cũ không mất. AuditEvent phải ghi: ai, khi nào, lý do, phiên bản cũ, phiên bản mới. UI pilot v0.1 chưa cần phức tạp, nhưng domain invariant phải tồn tại từ đầu — tránh migration đau đớn sau.
- **Relationships:** thuộc về 1 Encounter, có 0-nhiều CareTask được sinh ra khi Sign.
- **Downstream use:** khi Sign, tự động tạo CareTask (automation đầu tiên, không phải AI).
- **Cố tình chưa model:** warning signs vẫn là free-text (không structured field) — chưa có Rule Engine dùng đến, đúng nguyên tắc P-04.

## CareTask

- **Purpose:** nhiệm vụ vận hành cụ thể (vd tái khám ngày X) — nguồn cho Follow-up Queue.
- **Identity:** `CareTask.id`.
- **Creator:** hệ thống, tự động khi CarePlan được Sign (không phải bác sĩ tạo tay).
- **Lifecycle (stored status):** `OPEN` → `COMPLETED` (khi có Encounter mới liên quan, hoặc đánh dấu tay) hoặc `OPEN` → `CANCELLED`.
- **OVERDUE là derived state, không phải stored status:** `OVERDUE` = `status == OPEN AND dueDate < thời điểm hiện tại`, tính tại thời điểm truy vấn/hiển thị. Không lưu `OVERDUE` như một giá trị status riêng trừ khi có yêu cầu downstream cụ thể được ghi lại tại đây (hiện chưa có).
- **Downstream use:** màn hình "Today"/Follow-up Queue lọc theo `status` + `dueDate` (tính `OVERDUE` khi query).

## Patient Timeline

- **Không phải entity lưu trữ** — là projection (phép chiếu) dựng từ Encounter + CarePlan + CareTask theo thời gian, sắp theo CareEpisode.
- **Invariant:** Timeline không bao giờ là nguồn ghi dữ liệu (write target) — mọi thay đổi phải đi qua Encounter/CarePlan gốc. Điều này giữ đúng P-10 (one source of truth).

## AuditEvent

- **Purpose:** biết ai làm gì, khi nào, trên entity nào.
- **Lifecycle:** append-only, không sửa/xóa (xem architectural invariant tại `05_ARCHITECTURE_BASELINE.md`).
- **Naming:** `AuditEvent` là tên domain chuẩn dùng trong toàn bộ Documentation Baseline. Tên gọi tương ứng ở tầng schema/implementation (khi tạo) phải khớp hoặc mapping rõ ràng — quyết định cụ thể thuộc bootstrap kỹ thuật, không phải quyết định domain.

---

## Điều cố tình KHÔNG model ở v0.1

Theo Anti-Scope tại `01_PRODUCT_VISION_AND_SCOPE.md`: không có entity cho AI Draft/Prompt versioning (chưa cần vì DEC-001 manual-only), không có entity Communication/ZBS (Phase 2 — Continuous Care), không có Insurance/Billing entity.

## Việc cần khóa trước khi bootstrap kỹ thuật (xem 05_ARCHITECTURE_BASELINE.md)

- Naming domain-to-schema cho `AuditEvent`.
- Ngưỡng thời gian để CareEpisode gợi ý review (không phải tự động đóng).
- Cơ chế kỹ thuật cụ thể cho Amendment (bảng version riêng hay field version trên CarePlan).
- Cơ chế Amendment/versioning cho ClinicalNote nếu yêu cầu lâm sàng đòi hỏi (xem Encounter — ClinicalNote lifecycle ở trên).
