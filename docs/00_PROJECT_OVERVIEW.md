# GastroCare — Project Overview

Cập nhật: 2026-08-21
Trạng thái: DOCUMENTATION BASELINE CONSOLIDATION (Pass 1/4)

## GastroCare là gì?

> GastroCare là Clinical Care Management Platform (nền tảng quản lý chăm sóc lâm sàng) dành cho phòng khám chuyên khoa, bắt đầu từ tiêu hóa, giúp quản lý bệnh nhân xuyên suốt từ lượt khám, kế hoạch chăm sóc, follow-up đến kết quả điều trị.

AI không xuất hiện trong định nghĩa Core. Chi tiết scope/anti-scope xem `01_PRODUCT_VISION_AND_SCOPE.md`.

## Bài toán đang giải quyết

**Working Product Hypothesis (giả thuyết sản phẩm đang dùng để build, chưa xác minh bằng dữ liệu thật):** điểm đứt gãy đáng tập trung ban đầu được giả định nằm ở continuity after visit (tính liên tục sau khi bệnh nhân rời phòng khám) — lịch sử phân tán, follow-up (theo dõi tái khám) phụ thuộc trí nhớ, bệnh nhân quá hạn tái khám không được phát hiện. GastroCare đóng giả thuyết này bằng dữ liệu có cấu trúc + follow-up chủ động — không cần AI để làm việc đó. Giả thuyết này sẽ được kiểm chứng khi BS Thái dùng sản phẩm thật (nguyên tắc P-06, Build → Observe → Correct).

## Người dùng đầu tiên

- **BS Thái** — first pilot user (người dùng thử nghiệm đầu tiên) (OWNER CONFIRMED, xem `DECISION_LOG.md` DEC-004).
- Bệnh nhân của BS Thái — nhận giá trị gián tiếp qua việc bác sĩ không bỏ sót follow-up.

## Vì sao tiêu hóa? Vì sao Core trước AI?

Xem lý do đầy đủ tại `01_PRODUCT_VISION_AND_SCOPE.md` và các nguyên tắc P-01/P-02 tại `02_PRODUCT_PRINCIPLES.md`.

## Trạng thái hiện tại

```
IMPLEMENTATION STATUS: PAUSED FOR DOCUMENTATION BASELINE (OWNER CONFIRMED, 2026-08-21)
EXISTING TECHNICAL ARTIFACTS: PRESERVED AS REFERENCE
NEW RUNTIME CHANGES: NOT IN CURRENT SCOPE
NEXT GATE: DOCUMENTATION BASELINE v1.0 ACCEPTANCE
```

## Existing Project Assets

*Kiểm kê nguồn — đảm bảo One Source of Truth (P-10), không bắt đầu lại từ đầu.*

| Asset | Trạng thái | Vai trò |
|---|---|---|
| `gastrocare_core_v0.1.prisma` | DRAFT / REFERENCE | Ứng viên kỹ thuật, dùng để đối chiếu khi viết `04_CORE_DOMAIN_MODEL.md`, chưa phải schema đã duyệt |
| `DISCOVERY_ROUND1_GUIDE.md` + `DISCOVERY_ROUND1_OUTPUT_TEMPLATE.md` | REFERENCE | Dùng cho Discovery thật với BS Thái sau khi có sản phẩm để quan sát (Build → Observe → Correct), không phải điều kiện để bắt đầu build |
| Synthetic Discovery Baseline v0.1 (workflow/pain point/information map giả định) | REFERENCE | Input chính cho `03_CLINICAL_WORKFLOW_BASELINE.md` |
| Nền tảng GastroCare trước đây (multi-tenancy — đa khách hàng, NestJS/Prisma/PostgreSQL, RBAC — kiểm soát truy cập theo vai trò, hybrid patient identity — định danh bệnh nhân lai) | PARTIALLY AUTHORITATIVE / SUBJECT TO RECONCILIATION | Backend hiện có, dự án mới không tạo hạ tầng song song — nhưng từng phần chỉ được nâng lên AUTHORITATIVE sau khi rà lại trong Pass 2/3 |

## Bước tiếp theo

Pass 2 — Domain Foundation (`03_CLINICAL_WORKFLOW_BASELINE.md`, `04_CORE_DOMAIN_MODEL.md`).
