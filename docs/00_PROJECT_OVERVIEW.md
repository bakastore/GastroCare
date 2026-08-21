# GastroCare — Project Overview

Cập nhật: 2026-08-21
Trạng thái: DOCUMENTATION BASELINE v1.0 — RELEASE CANDIDATE

## GastroCare là gì?

> GastroCare là Clinical Care Management Platform (nền tảng quản lý chăm sóc lâm sàng) dành cho phòng khám chuyên khoa, giúp quản lý bệnh nhân xuyên suốt từ lượt khám, kế hoạch chăm sóc, follow-up đến kết quả điều trị. Chuyên khoa đầu tiên đang được giả định là tiêu hóa (CARRIED-FORWARD ASSUMPTION, chưa Owner-confirmed — xem `DECISION_LOG.md` A-001).

AI không xuất hiện trong định nghĩa Core. Chi tiết scope/anti-scope xem `01_PRODUCT_VISION_AND_SCOPE.md`.

## Bài toán đang giải quyết

**Working Product Hypothesis (giả thuyết sản phẩm đang dùng để build, chưa xác minh bằng dữ liệu thật):** điểm đứt gãy đáng tập trung ban đầu được giả định nằm ở continuity after visit (tính liên tục sau khi bệnh nhân rời phòng khám) — lịch sử phân tán, follow-up (theo dõi tái khám) phụ thuộc trí nhớ, bệnh nhân quá hạn tái khám không được phát hiện. GastroCare đóng giả thuyết này bằng dữ liệu có cấu trúc + follow-up chủ động — không cần AI để làm việc đó. Giả thuyết này sẽ được kiểm chứng khi BS Thái dùng sản phẩm thật (nguyên tắc P-06, Build → Observe → Correct).

## Người dùng đầu tiên

- **BS Thái** — first pilot user (người dùng thử nghiệm đầu tiên) (OWNER CONFIRMED, xem `DECISION_LOG.md` DEC-004).
- Bệnh nhân của BS Thái — nhận giá trị gián tiếp qua việc bác sĩ không bỏ sót follow-up.

## Vì sao tiêu hóa (giả thuyết hiện tại)? Vì sao Core trước AI?

Xem lý do đầy đủ tại `01_PRODUCT_VISION_AND_SCOPE.md` và các nguyên tắc P-01/P-02 tại `02_PRODUCT_PRINCIPLES.md`.

## Trạng thái hiện tại

```
PROJECT TYPE: GREENFIELD
IMPLEMENTATION: NOT STARTED
DOCUMENTATION BASELINE v1.0: RELEASE CANDIDATE (10/10 documents)
NEXT GATE: DOCUMENTATION BASELINE v1.0 — OWNER REVIEW
```

## Existing Project Assets

*Kiểm kê nguồn — đảm bảo One Source of Truth (P-10), không bắt đầu lại từ đầu. Repository này là GREENFIELD: không có source code, schema, hay database nào tồn tại (xem `PROJECT_STATE.md`).*

| Asset | Trạng thái | Vai trò |
|---|---|---|
| `DISCOVERY_ROUND1_GUIDE.md` + `DISCOVERY_ROUND1_OUTPUT_TEMPLATE.md` | REFERENCE (không có trong repo hiện tại) | Dự kiến dùng cho Discovery thật với BS Thái sau khi có sản phẩm để quan sát (Build → Observe → Correct), không phải điều kiện để bắt đầu build |
| Synthetic Discovery Baseline v0.1 (workflow/pain point/information map giả định) | WORKING ASSUMPTION | Input chính cho `03_CLINICAL_WORKFLOW_BASELINE.md`, chưa xác nhận bằng quan sát thật |

Một schema Prisma nháp (`gastrocare_core_v0.1.prisma`) từng được dùng làm tài liệu tham khảo kỹ thuật khi soạn `04_CORE_DOMAIN_MODEL.md`, nhưng file này **không tồn tại trong repository hiện tại**. Domain model tại `04_CORE_DOMAIN_MODEL.md` là DOMAIN CANDIDATE độc lập, không phụ thuộc vào file đó.

## Bước tiếp theo

Sau khi Owner review Documentation Baseline v1.0 (10 tài liệu), bước tiếp theo là Phase FOUNDATION tại `07_ROADMAP_AND_GATES.md`.
