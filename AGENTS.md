# GastroCare — AI Agent Working Agreement

## A. Startup Protocol

Trước khi phân tích hoặc đề xuất thay đổi, agent phải đọc theo thứ tự:

1. `docs/PROJECT_STATE.md`
2. `docs/DECISION_LOG.md`
3. `docs/07_ROADMAP_AND_GATES.md`

Sau đó đọc SSOT chuyên biệt cho task hiện tại được chỉ định trong `CURRENT EXECUTION CONTEXT` của `PROJECT_STATE.md`.

Nếu task liên quan Longo Clinical Core, phải đọc:

4. `docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md`

Nếu CORE-04 Implementation Contract đã tồn tại thì đọc thêm:

5. `docs/09_CORE04_IMPLEMENTATION_CONTRACT.md`

Nếu task liên quan domain/schema/migration/privacy thì đọc thêm:

- `docs/04_CORE_DOMAIN_MODEL.md`
- `docs/05_ARCHITECTURE_BASELINE.md`
- `docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md`

Không yêu cầu Owner kể lại lịch sử nếu repository có thể trả lời.

## B. Authority Hierarchy

```text
Newest explicit Owner Decision
> Previous Owner Decision
> Verified Project State
> Approved Baseline
> Working Assumption
> AI Recommendation
```

`OWNER LOCKED` ánh xạ vào `OWNER DECISION`.

Khi tài liệu cũ và tài liệu mới xung đột, không tự hòa giải bằng suy đoán; áp dụng authority hierarchy.

## C. Current Task Discovery

Không hard-code task đang làm vào `AGENTS.md`.

Task hiện tại phải lấy từ `docs/PROJECT_STATE.md`, section `CURRENT EXECUTION CONTEXT`. Nhờ vậy `AGENTS.md` ổn định qua nhiều phase.

### Active Branch Rule

`CURRENT EXECUTION CONTEXT` có thể chỉ định một branch khác default branch (`main`).

Sau khi đọc `PROJECT_STATE.md`, agent phải:

1. xác định `Current branch`;
2. nếu branch hiện hành khác `main`, ưu tiên đọc các artifact của task hiện tại từ branch đó;
3. không suy ra rằng file chưa tồn tại chỉ vì không thấy nó trên `main`;
4. khi dùng GitHub connector hoặc remote source, phải xác minh branch/ref trước khi kết luận trạng thái công việc.

`main` là durable baseline (đường nền ổn định); current execution branch là nguồn cho work-in-progress (công việc đang triển khai).

## D. Git Governance

Trước mọi write operation (thao tác ghi):

```text
git status
git diff
```

Không được:

- force push;
- reset accepted checkpoints;
- rewrite accepted history;
- move protected baseline tags.

Không commit hoặc push nếu Owner chưa cho phép rõ ràng. Không tự tạo branch mới nếu current execution context đã chỉ định branch.

## E. Clinical Safety / Privacy

Không tự suy ra real-patient runtime đã được cho phép. Agent phải đọc `PROJECT_STATE.md` và safety governance trước khi sử dụng dữ liệu thật.

Không đưa dữ liệu bệnh nhân thật vào:

- Git;
- seed;
- test;
- fixture;
- screenshot;
- documentation example;
- browser E2E.

Synthetic data = dữ liệu giả lập.

Sanitized aggregate evidence = bằng chứng tổng hợp đã được khử thông tin nhận dạng.

Không được nhầm hai loại này. Không fabricate clinical semantics (bịa đặt ngữ nghĩa lâm sàng). Các định nghĩa `DEFERRED_WITH_REASON` phải tiếp tục deferred cho đến khi có authority phù hợp.

## F. Development Philosophy

Build → Observe → Correct.

Core-first. Manual-first. AI deferred trừ khi roadmap mở rõ ràng AI phase.

Không biến GastroCare thành HIS/full EMR/generic research database nếu chưa có Owner Decision.

## G. Agent Roles

ChatGPT:

- architecture/product synthesis;
- Owner decision support;
- implementation contract;
- review.

Claude Code:

- implementation;
- tests;
- corrections.

Codex:

- repository inspection;
- read-only audit;
- independent verification.

Owner:

- final product/clinical decisions;
- authorization;
- acceptance.

Các vai trò này là preferred workflow (quy trình ưu tiên), không phải lý do để lặp review không cần thiết.

## H. Stop Conditions

STOP và báo Owner khi:

- SSOT conflict không giải được bằng authority hierarchy;
- clinical semantics bị thiếu nhưng implementation cần chúng;
- task yêu cầu real-patient data khi gate chưa cho phép;
- migration phá vỡ invariant mà chưa review;
- repo state khác `CURRENT EXECUTION CONTEXT` đáng kể.

## I. Language

Tiếng Việt là ngôn ngữ tài liệu/hướng dẫn mặc định.

Technical terms có thể giữ English term (nghĩa tiếng Việt) khi hữu ích. Code identifiers giữ nguyên.
