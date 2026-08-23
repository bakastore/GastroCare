# GastroCare — Core Domain Model

Cập nhật: 2026-08-21

Đây là tài liệu domain (miền nghiệp vụ), **không phải Prisma schema**. Câu chữ mô tả trạng thái greenfield trong baseline ban đầu là bối cảnh lịch sử; Technical Core hiện đã được triển khai và `CLOSED`, còn GastroCare Core tổng thể đang `IN PROGRESS` (xem `PROJECT_STATE.md`). Các phần vẫn mang nhãn DOMAIN CANDIDATE tiếp tục là thiết kế đề xuất, trừ khi đã được một Owner Decision mới hơn khóa rõ ràng.

> **Ghi chú thẩm quyền cho Longo Clinical Core:** Khi chi tiết xung đột hoặc [`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md) quy định cụ thể hơn, tài liệu 08 có thẩm quyền cao hơn đối với vòng đời `CareEpisode`; thao tác bắt đầu/đóng/mở lại rõ ràng; quy tắc `Encounter.episodeId`; `Encounter.occurredAt`; `ClinicalFormSubmission`; amendment lineage (chuỗi sửa đổi); lập lịch hậu phẫu; và các họ biểu mẫu Longo. Tài liệu 08 không thay thế toàn bộ Core Domain Model này.

## Sơ đồ domain

```
Tenant
 │
 └── Patient
       │
       ├── CareEpisode  (đã khóa về domain cho Clinical Core tiếp theo;
       │                 chưa triển khai trong technical-core-v0.1)
       │      │
       │      └── Encounter
       │              ├── ClinicalNote (nội dung tường thuật lâm sàng của Encounter)
       │              ├── ClinicalFormSubmission (biểu mẫu có cấu trúc, có phiên bản)
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
- **Start (bắt đầu):** `CareEpisode` không tự động bắt đầu. Việc bắt đầu là một hành động rõ ràng và được phân quyền.
- **Lifecycle:** `ACTIVE` → `CLOSED`. `CareEpisode` không tự động đóng; việc đóng là một hành động rõ ràng và được phân quyền.
- **Reopen (mở lại):** là hành động rõ ràng và được phân quyền, bắt buộc có lý do và `AuditEvent`.
- **Relationships:** 1 Patient có nhiều CareEpisode; 1 CareEpisode có nhiều Encounter.
- **Downstream use:** Patient Timeline dùng CareEpisode để nhóm hiển thị; sau này Clinical Intelligence (nếu triển khai) dùng để truy vấn theo đợt bệnh.

## Encounter

- **Purpose:** một lượt khám cụ thể, đơn vị ghi nhận chính của bác sĩ.
- **Identity:** `Encounter.id`.
- **Creator:** bác sĩ, tại thời điểm khám.
- **Lifecycle:** tạo một lần khi khám, sau khi lưu KHÔNG chỉnh sửa tự do (xem invariant Amendment bên dưới).
- **Relationships:** thuộc về 1 Patient, thuộc về 0-1 CareEpisode ở Core schema vì `Encounter.episodeId` nullable. Với workflow Longo, application validation (xác thực ở tầng ứng dụng) bắt buộc Encounter phải thuộc một `CareEpisode`.
- **Chứa (khái niệm ClinicalNote):** reason for visit, clinical note (text), assessment. Ở v0.1 (DOMAIN CANDIDATE), đây là field trực tiếp trên Encounter, KHÔNG phải bảng riêng — tách bảng riêng chỉ cần thiết khi có nhiều "phiên bản" ghi chú (vd AI draft vs bác sĩ sửa), hiện chưa cần vì DEC-001 là manual-only.
- **ClinicalNote lifecycle (tường minh):** ở v0.1, ClinicalNote KHÔNG được ký (sign) độc lập với Encounter — nó là field nội dung của Encounter, và tính bất biến/immutability chỉ được áp dụng ở mức CarePlan khi Sign (xem invariant Amendment bên dưới). Encounter/ClinicalNote sau khi lưu không có quy trình chỉnh sửa tự do ở UI. ClinicalNote chưa có amendment/versioning riêng trong Technical Core hiện tại; nếu sau này yêu cầu lâm sàng cần cơ chế này thì phải có Owner Decision và thiết kế riêng.
- **Phân biệt với `ClinicalFormSubmission`:** `ClinicalNote` có thể tiếp tục là nội dung/tường thuật lâm sàng của Encounter như định nghĩa hiện tại. `ClinicalFormSubmission` là thực thể biểu mẫu lâm sàng có cấu trúc, có phiên bản và đã được triển khai riêng trong Technical Core. Đây là hai khái niệm khác nhau; đối với biểu mẫu Longo có cấu trúc, tài liệu 08 là nguồn có thẩm quyền.
- **Downstream use:** Patient Timeline hiển thị theo thời gian; CareEpisode dùng để nhóm.
- **Lineage field (`source`) — DOMAIN CANDIDATE:** đề xuất mặc định `MANUAL`, để tránh migration khi mở AI sau này (P-02). `source` hiện vẫn là DOMAIN CANDIDATE; chưa được xác nhận là field đã triển khai trong schema hiện tại.

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

## Các điểm từng để mở trong baseline ban đầu

Danh sách dưới đây được giữ làm bối cảnh lịch sử. Trạng thái hiện hành phải đối chiếu `PROJECT_STATE.md`, implementation đã xác minh và Owner-locked SSOT; không được hiểu rằng Technical Core vẫn chưa được bootstrap.

- Naming domain-to-schema cho `AuditEvent`.
- Ngưỡng thời gian để CareEpisode gợi ý review (không phải tự động đóng).
- Cơ chế kỹ thuật cụ thể cho Amendment (bảng version riêng hay field version trên CarePlan).
- Cơ chế Amendment/versioning cho ClinicalNote nếu yêu cầu lâm sàng đòi hỏi (xem Encounter — ClinicalNote lifecycle ở trên).
