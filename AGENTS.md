# GastroCare — AI Agent Working Agreement

## A. Startup Protocol v2 — Context Modes

Mỗi task phải dùng một context mode: `FOCUSED` hoặc `FULL`.

`/gastrocare-dev:startup` chỉ chạy một lần khi bắt đầu session.

Khi task thay đổi trong cùng session, agent chỉ re-evaluate context mode.
Nếu FOCUSED cần chuyển sang FULL thì đọc thêm FULL context trực tiếp,
không yêu cầu Owner chạy lại `/gastrocare-dev:startup`.

Chỉ chạy lại startup khi:
- mở session mới;
- branch/HEAD thay đổi ngoài session;
- repository state bị thay đổi đáng kể từ bên ngoài;
- startup context trước đó không còn đáng tin.

Trước mọi phân tích hoặc execution, agent phải lấy execution facts từ Git thực tế:

```text
git branch --show-current
git rev-parse HEAD
git status --short
git rev-parse '@{u}' 2>/dev/null || true
```

`.ai/HANDOFF.md`, nếu tồn tại, chỉ là local non-authoritative handoff cache.
HANDOFF không được override Git facts, Owner Decision, applicable Contract hoặc governance SSOT.
HANDOFF không authorize checkpoint/task mới.

### FOCUSED

Chỉ được dùng khi đồng thời đủ cả 4 điều kiện:

1. Owner task explicit và bounded.
2. Current Decision / Package / applicable Contract đã biết.
3. Relevant source/test/finding scope đã biết.
4. Không có governance conflict hoặc clinical semantic ambiguity đã biết.

FOCUSED chỉ đọc context cần thiết:
- `AGENTS.md`;
- `.ai/HANDOFF.md` nếu có;
- đúng section của applicable Contract;
- source/test/evidence trong declared scope.

FOCUSED không mặc định đọc toàn bộ `docs/DECISION_LOG.md`, `docs/07_ROADMAP_AND_GATES.md`,
historical Decisions, unrelated Contracts hoặc unrelated repository files.

FOCUSED phải tự chuyển sang FULL ngay khi phát hiện:
- unexpected branch;
- material pre-existing diff ngoài declared scope;
- HANDOFF/task inconsistency ảnh hưởng execution;
- applicable Contract conflict với Owner instruction;
- evidence của newer applicable Owner Decision;
- clinical semantic ambiguity;
- schema/migration impact ngoài declared scope;
- material cross-package dependency;
- task không thể giải quyết an toàn trong declared scope.

Escalation chỉ để đọc thêm authoritative context, không cần Owner permission.

### FULL

Dùng khi thiếu bất kỳ điều kiện FOCUSED nào hoặc khi FOCUSED bị escalation.

FULL đọc theo thứ tự:
1. `docs/PROJECT_STATE.md`
2. `docs/DECISION_LOG.md`
3. `docs/07_ROADMAP_AND_GATES.md`

Sau đó đọc current authoritative SSOT / Implementation Contract và tài liệu task-specific cần thiết.
FULL không có nghĩa đọc toàn bộ repository.

Mọi agent report phải mở đầu:

```text
MODE: FOCUSED | FULL
REF: branch=<actual> HEAD=<actual SHA> tree=<CLEAN|DIRTY>
```

Không yêu cầu Owner kể lại lịch sử nếu repository có thể trả lời.

## B. Authority Hierarchy

Governance authority:

```text
Newest explicit Owner Decision
> applicable OWNER LOCKED Decision / Contract
> PROJECT_STATE / DECISION_LOG
> Approved Baseline
> Working Assumption
> AI Recommendation
```

Execution facts:

```text
Actual local Git
> Owner-provided local evidence
> explicit remote branch/ref
> HANDOFF cache
```

Git/source existence không tự tạo authorization.
Khi local và remote khác nhau, remote không được override actual local execution state.
`OWNER LOCKED` ánh xạ vào Owner Decision.

Khi governance authorities xung đột, không tự hòa giải bằng suy đoán; áp dụng authority hierarchy ở trên.

## C. Current Task Discovery

Không hard-code current task vào `AGENTS.md`.

Trong `FOCUSED`, task / authority / scope phải đã được xác định rõ từ Owner instruction
và/hoặc HANDOFF + applicable Contract. Nếu không xác định chắc chắn, chuyển sang FULL.

Trong `FULL`, task hiện tại lấy từ `docs/PROJECT_STATE.md`, section `CURRENT EXECUTION CONTEXT`.

### Active Branch Rule

Actual branch luôn lấy từ Git trước.

- Trong FOCUSED: so actual branch với branch được Owner/HANDOFF mong đợi.
  Material mismatch => ghi `HANDOFF STALE` nếu liên quan và chuyển FULL.
- Trong FULL: đối chiếu actual branch với `CURRENT EXECUTION CONTEXT`.
- Khi dùng GitHub connector hoặc remote source, phải dùng explicit branch/ref;
  không mặc định `main` đại diện cho local work-in-progress.
- Không kết luận file/task chưa tồn tại chỉ vì không thấy trên `main`.

`main` là durable published baseline. Current execution branch/local working tree là execution state
khi work chưa được merge/publish.

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

## J. Lean Governance (Owner Decision [[DEC-024]], 2026-09-26)

Mục tiêu: governance tối thiểu đủ an toàn, dồn công vào code + test.

1. **`docs/PROJECT_STATE.md` = con trỏ hiện tại.** Thay thế tại chỗ, mục tiêu ≤ 100 dòng.
   Không lưu lịch sử, không ghi chú `HISTORICAL/SUPERSEDED`, không chép số test.
   Section `CURRENT EXECUTION CONTEXT` phải là section cuối và có dòng
   `| Implementation Contract | <path> |` (hook `protect-schema` đọc dòng này).
2. **Lịch sử chỉ append vào `docs/DECISION_LOG.md`.** Không chép cùng một nội dung sang
   `PROJECT_STATE.md` hay `07_ROADMAP_AND_GATES.md`. Roadmap chỉ sửa khi đổi phase.
3. **Chỉ cập nhật governance docs khi:** mở package, đóng package, có Owner Decision mới,
   hoặc gặp blocker. Tiến độ từng Tn ghi ở commit message / PR description, không ghi vào docs.
4. **Gộp gate:** Owner lock một Implementation Contract đồng thời là implementation
   authorization, trừ khi Owner ghi rõ khác. Không tách một gate riêng chỉ để "landing" docs.
   Implementation authorization bao gồm commit/push trên implementation branch trong phạm vi
   Contract; merge vào `main` vẫn cần Owner.
5. **Audit code, không audit câu chữ.** Mỗi package một independent audit, làm trên
   code + test + diff khi package xong. Khi hai agent mâu thuẫn về nội dung một dòng,
   đọc thẳng dòng đó (`sed -n 'Np' file`) thay vì mở thêm vòng audit.
6. **Engineering detail không lên Owner Decision.** Chỉ ngữ nghĩa lâm sàng/sản phẩm mới cần
   Owner (ví dụ "LTFU sau 2 tháng lịch" là ngữ nghĩa; cách tính ngày, timezone handling,
   naming, cấu trúc test là engineering). Engineering detail được chốt bằng code + test.
7. **Không viết Implementation Contract cho phạm vi còn câu hỏi lâm sàng mở.** Hỏi và chốt
   câu hỏi lâm sàng với BS Thái/Owner trước, rồi mới viết contract.
8. **Contract ngắn:** chỉ ghi scope, invariant, schema được phép, acceptance test.
   Không chép lại SSOT lâm sàng; tham chiếu thay vì copy.
