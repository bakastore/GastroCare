# GastroCare — Safety, Privacy & Governance

Cập nhật: 2026-08-21

Đây là nguồn sự thật duy nhất (normative home) cho toàn bộ yêu cầu về an toàn, quyền riêng tư, và governance của GastroCare. [05_ARCHITECTURE_BASELINE.md](05_ARCHITECTURE_BASELINE.md) chỉ tham chiếu tài liệu này, không lặp lại chi tiết (P-10).

```
STATUS: PROPOSED BASELINE — RELEASE CANDIDATE
OWNER APPROVAL REQUIRED
NO AUTHENTICATION, AUTHORIZATION, OR DATABASE SYSTEM EXISTS TODAY
```

## Authentication

- FACT/REQUIREMENT: mọi truy cập vào dữ liệu bệnh nhân phải qua một identity đã xác thực — không có chế độ truy cập ẩn danh trong Core.
- Cơ chế xác thực cụ thể (password, SSO, MFA...) là UNKNOWN / OPEN ITEM, để quyết định ở giai đoạn bootstrap kỹ thuật, miễn không vi phạm yêu cầu trên.

## Authorization / RBAC

- FUTURE OPTION có role tối thiểu: bác sĩ (full clinical access trong tenant của mình), lễ tân (đăng ký bệnh nhân, không truy cập nội dung lâm sàng chi tiết trừ khi cần), admin hệ thống.
- REQUIREMENT: mọi thao tác ghi vào entity lâm sàng (Encounter, CarePlan) phải gắn với actor cụ thể, phục vụ AuditEvent.
- Phân quyền chi tiết theo role là UNKNOWN / OPEN ITEM — không khóa ở Documentation Baseline v1.0 (P-09).

## Tenant Isolation

- REQUIREMENT (liên kết architectural invariant tại [05_ARCHITECTURE_BASELINE.md](05_ARCHITECTURE_BASELINE.md)): không có truy vấn, API response, hay background job nào được phép trả dữ liệu cross-tenant.
- Vi phạm tenant isolation được coi là BLOCKING severity trong mọi review kỹ thuật tương lai.

## Clinical Record Integrity

- REQUIREMENT: bản ghi lâm sàng đã ký (CarePlan `SIGNED`) là immutable; mọi thay đổi phải qua cơ chế Amendment với lineage đầy đủ (xem [04_CORE_DOMAIN_MODEL.md](04_CORE_DOMAIN_MODEL.md) — CarePlan).
- REQUIREMENT: AuditEvent append-only, không update/delete (xem 05_ARCHITECTURE_BASELINE.md).

## Patient Data Sensitivity

- FACT: dữ liệu bệnh nhân trong GastroCare là dữ liệu sức khỏe cá nhân nhạy cảm.
- REQUIREMENT: không log nội dung lâm sàng chi tiết (clinical note, assessment) vào hệ thống log kỹ thuật chung (application log, error tracking) — chỉ log identifier và metadata thao tác.
- Mã hóa dữ liệu at-rest/in-transit cụ thể: UNKNOWN / OPEN ITEM, quyết định ở bootstrap kỹ thuật.

## Consent

- LEGAL REVIEW REQUIRED: yêu cầu consent cụ thể (hình thức, lưu trữ bằng chứng consent, phạm vi) đối với dữ liệu y tế tại Việt Nam cần được luật sư/chuyên gia pháp lý xác nhận trước khi đưa vào production với dữ liệu bệnh nhân thật.
- WORKING ASSUMPTION (chưa xác nhận pháp lý): pilot ban đầu với BS Thái dùng dữ liệu do chính bác sĩ nhập, trong quan hệ khám chữa bệnh đã có sẵn — không coi là thay thế cho quy trình consent chính thức khi mở rộng.

## Audit Governance

- REQUIREMENT: AuditEvent ghi tối thiểu — actor, action, entity, entity id, timestamp. Chi tiết field bổ sung: UNKNOWN / OPEN ITEM.
- REQUIREMENT: AuditEvent không được xóa bởi bất kỳ tính năng người dùng nào, kể cả admin, trong luồng vận hành bình thường.

## Retention / Deletion

- LEGAL REVIEW REQUIRED: thời hạn lưu trữ hồ sơ y tế theo quy định Việt Nam cần xác nhận pháp lý trước khi định nghĩa chính sách retention chính thức.
- WORKING ASSUMPTION: GastroCare Core không xóa cứng (hard delete) hồ sơ Patient hay bản ghi lâm sàng đã ký; chỉ hỗ trợ archive nếu cần (xem 04_CORE_DOMAIN_MODEL.md — Patient lifecycle).

## Backup Requirement

- REQUIREMENT: khi có database thật, phải có cơ chế backup định kỳ và quy trình restore đã kiểm chứng trước khi dùng với dữ liệu bệnh nhân thật (xem Real-Patient-Data Gate bên dưới).
- Tần suất/công cụ backup cụ thể: UNKNOWN / OPEN ITEM.

## Access Governance

- REQUIREMENT: quyền truy cập hệ thống (kể cả truy cập kỹ thuật/dev vào production data trong tương lai) phải được giới hạn tối thiểu cần thiết và có audit trail riêng.
- Không có quy trình cấp/thu hồi quyền chi tiết ở baseline này — UNKNOWN / OPEN ITEM.

## Real-Patient-Data Gate

- REQUIREMENT (BLOCKING trước khi dùng dữ liệu bệnh nhân thật): trước khi GastroCare xử lý dữ liệu bệnh nhân thật đầu tiên (kể cả pilot với BS Thái), tối thiểu tất cả các điều kiện sau phải được thỏa mãn — đây là mandatory minimum, không phải danh sách để chọn một phần:
  1. Authentication hoạt động (xem Authentication).
  2. Authorization/RBAC được enforce (xem Authorization / RBAC).
  3. Tenant isolation đã được kiểm chứng (xem Tenant Isolation).
  4. Audit trail hoạt động — AuditEvent ghi nhận đầy đủ theo Audit Governance.
  5. Backup/restore đã được kiểm chứng (xem Backup Requirement).
  6. Toàn bộ yêu cầu pháp lý/quyền riêng tư bắt buộc áp dụng (mandatory legal/privacy requirements — bao gồm mọi mục đang đánh dấu LEGAL REVIEW REQUIRED ở trên) đã được giải quyết dứt điểm.
- Owner KHÔNG được waive các yêu cầu pháp lý/tuân thủ bắt buộc (mục 6). Owner risk acceptance tường minh chỉ áp dụng cho rủi ro tồn dư (residual risk) không thuộc nghĩa vụ pháp lý bắt buộc — ví dụ mức độ chi tiết của quy trình vận hành nội bộ, không phải các yêu cầu pháp lý về dữ liệu y tế.
- Đây là gate độc lập với Roadmap capability gates ở [07_ROADMAP_AND_GATES.md](07_ROADMAP_AND_GATES.md) — không được bỏ qua vì lý do tiến độ.

## AI-Specific Privacy/Processing

- FUTURE / AI PHASE: các yêu cầu privacy riêng cho xử lý dữ liệu qua AI provider (data residency, việc dùng dữ liệu bệnh nhân để training, redaction...) chưa cần định nghĩa cho Core — chỉ trở thành REQUIREMENT khi AI Value-Added Layer ([07_ROADMAP_AND_GATES.md](07_ROADMAP_AND_GATES.md)) được kích hoạt.
