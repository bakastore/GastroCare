# GastroCare — Architecture Baseline

Cập nhật: 2026-08-21

```
STATUS: PROPOSED BASELINE — RELEASE CANDIDATE
OWNER APPROVAL REQUIRED
NOT EXISTING SOFTWARE — NO CODE, SCHEMA, OR DATABASE EXISTS TODAY
```

Tài liệu này mô tả kiến trúc **đề xuất** để hiện thực hóa [04_CORE_DOMAIN_MODEL.md](04_CORE_DOMAIN_MODEL.md) trong tương lai. Đây là PROPOSED BASELINE — RELEASE CANDIDATE, chưa phải APPROVED, chờ Owner phê duyệt qua Documentation Baseline v1.0 Owner Review — không phải mô tả hệ thống đang chạy. GastroCare hiện chưa có backend, schema, hay database nào được tạo (xem [PROJECT_STATE.md](PROJECT_STATE.md)).

## Layer Model (đề xuất)

```
Experience    — giao diện người dùng (web trước, mobile là FUTURE OPTION — xem 01_PRODUCT_VISION_AND_SCOPE.md Anti-Scope)
    ↓
Application   — use case, orchestration, quyền truy cập theo ngữ cảnh
    ↓
Domain        — entity, invariant, lifecycle (xem 04_CORE_DOMAIN_MODEL.md — nguồn sự thật duy nhất cho domain)
    ↓
Data          — persistence, migration, audit trail
    ↓
Governance    — cắt ngang mọi layer: auth, RBAC, tenant isolation, audit (xem 06_SAFETY_PRIVACY_AND_GOVERNANCE.md — nguồn sự thật duy nhất cho governance)
```

Domain layer không phụ thuộc vào Experience hay bất kỳ AI provider nào — xem invariant "Domain independence from AI providers" bên dưới.

## Architectural Invariants

Các bất biến sau là PROPOSED BASELINE — RELEASE CANDIDATE (chờ Owner phê duyệt), dự kiến giữ nguyên qua mọi lựa chọn công nghệ cụ thể một khi được duyệt:

- **Tenant isolation:** mọi truy vấn dữ liệu phải bị giới hạn trong phạm vi một Tenant; không có truy vấn cross-tenant ngầm định. Chi tiết cơ chế enforcement thuộc [06_SAFETY_PRIVACY_AND_GOVERNANCE.md](06_SAFETY_PRIVACY_AND_GOVERNANCE.md).
- **Patient identity:** `Patient.id` là định danh nội bộ bất biến; matching signals (tên, năm sinh, SĐT) không bao giờ được dùng làm identity, và hệ thống không tự động merge hồ sơ nghi trùng (xem 04_CORE_DOMAIN_MODEL.md — Patient).
- **Signed-record immutability:** một bản ghi lâm sàng đã ký (vd CarePlan `SIGNED`) không bị ghi đè bởi bất kỳ thao tác nào ở tầng Data.
- **Amendment/version lineage:** sửa một bản ghi đã ký phải tạo bản ghi mới, giữ liên kết tới bản cũ (actor, timestamp, reason, phiên bản cũ/mới) — không xóa hoặc ghi đè lịch sử.
- **Append-only audit:** AuditEvent chỉ được thêm (insert), không bao giờ update hoặc delete.
- **Patient Timeline projection:** Timeline luôn là read model dựng từ Encounter/CarePlan/CareTask; không bao giờ là write target độc lập.
- **Domain independence from AI providers:** Domain layer không import, gọi trực tiếp, hoặc phụ thuộc runtime vào bất kỳ AI provider nào. Tích hợp AI (khi triển khai) phải nằm ở một layer riêng, giao tiếp với Domain qua interface ổn định.
- **Migration review before application:** không migration nào (khi bắt đầu có database) được áp dụng vào môi trường có dữ liệu thật mà không qua review — chi tiết governance ở [06_SAFETY_PRIVACY_AND_GOVERNANCE.md](06_SAFETY_PRIVACY_AND_GOVERNANCE.md).
- **Separation of domain core from future AI layers:** cấu trúc thư mục/module (khi implement) phải phản ánh rõ ranh giới Core vs AI Value-Added Layer, để việc bật/tắt AI không đòi hỏi thay đổi Domain.

## Proposed Technology Baseline

```
STATUS: PROPOSED TECHNOLOGY BASELINE — CHƯA CÓ CODE NÀO ĐƯỢC TẠO
```

Đề xuất công nghệ (chưa triển khai, không phải "existing backend"):

- **NestJS** — application/API layer.
- **Prisma** — data access/ORM (chưa có `schema.prisma` nào tồn tại trong repo hiện tại).
- **PostgreSQL** — persistence.
- **REST API** — giao tiếp Experience ↔ Application.

Không có bất kỳ "existing NestJS backend", "current Prisma schema", hay "existing database" nào trong repository này. Nếu tài liệu khác từng dùng các cụm từ đó, chúng đã được reconcile (xem [00_PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) và [04_CORE_DOMAIN_MODEL.md](04_CORE_DOMAIN_MODEL.md)).

## Việc cần khóa trước khi bootstrap kỹ thuật

- Thống nhất tên gọi domain-to-schema cho AuditEvent (naming, không phải quyết định domain — xem 04_CORE_DOMAIN_MODEL.md).
- Cơ chế kỹ thuật cụ thể cho Amendment lineage (bảng version riêng hay field version).
- Ngưỡng thời gian gợi ý review CareEpisode không hoạt động (không phải điều kiện đóng tự động — xem 04_CORE_DOMAIN_MODEL.md — CareEpisode).

## Out of Scope (kiến trúc)

Theo Anti-Scope tại [01_PRODUCT_VISION_AND_SCOPE.md](01_PRODUCT_VISION_AND_SCOPE.md): không thiết kế hạ tầng cho AI Scribe/diagnosis/chatbot, không thiết kế multi-region/multi-specialty scaling, không thiết kế billing/insurance integration ở baseline này.
