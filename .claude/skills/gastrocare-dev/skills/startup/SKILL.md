---
name: startup
description: Thực thi Startup Protocol v2 của GastroCare: xác minh Git thực tế, chọn FOCUSED hoặc FULL theo AGENTS.md, đọc đúng context cần thiết và trả STARTUP STATUS.
disable-model-invocation: true
---

# GastroCare Startup

Skill này bootstrap context một lần ở đầu session.

Task tiếp theo trong cùng session không gọi lại skill.
Agent re-evaluate FOCUSED/FULL trực tiếp.

Nếu FOCUSED cần escalate sang FULL thì đọc FULL context theo protocol bên dưới,
không yêu cầu Owner chạy lại slash command.

READ-ONLY — skill này không sửa repository.

## 1. Actual Git state

Luôn lấy execution facts từ Git thực tế trước:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git rev-parse '@{u}' 2>/dev/null || true
```

Xác định actual branch, HEAD, working tree CLEAN/DIRTY và upstream HEAD nếu có.
Không tự stash/checkout/reset/clean hoặc bỏ qua pre-existing diff.
Git thực tế là authority cho branch / HEAD / working-tree / local source state.

## 2. Context Mode Gate

Đọc `AGENTS.md`.

Nếu `.ai/HANDOFF.md` tồn tại, được phép đọc để lấy handoff context nhưng phải coi đây là
NON-AUTHORITATIVE cache. HANDOFF không override Git facts, Owner Decision, applicable Contract
hoặc governance SSOT và không authorize checkpoint/task mới.

Chọn `FOCUSED` chỉ khi đồng thời đủ cả 4:

1. Owner task explicit và bounded.
2. Current Decision / Package / applicable Contract đã biết.
3. Relevant source/test/finding scope đã biết.
4. Không có governance conflict hoặc clinical semantic ambiguity đã biết.

Nếu đủ cả 4:
- `MODE = FOCUSED`;
- đọc đúng applicable Contract section;
- đọc source/test/evidence trong declared scope;
- không tự động đọc full `PROJECT_STATE.md`, `DECISION_LOG.md`, Roadmap, historical Decisions
  hoặc unrelated Contracts.

Nếu HANDOFF có Expected branch khác actual Git branch theo cách material: ghi `HANDOFF STALE`
và chuyển FULL.

Trong FOCUSED, tự chuyển `FOCUSED -> FULL` nếu phát hiện:
- unexpected branch;
- material pre-existing diff ngoài declared scope;
- HANDOFF/task inconsistency material;
- applicable Contract conflict với Owner instruction;
- evidence của newer applicable Owner Decision;
- clinical semantic ambiguity;
- schema/migration impact ngoài scope;
- material cross-package dependency;
- task không thể giải quyết an toàn trong declared scope.

Escalation chỉ để đọc thêm authoritative context, không cần Owner permission.

Nếu thiếu bất kỳ điều kiện FOCUSED nào: `MODE = FULL`.

## 3. FULL Bootstrap

Chỉ thực hiện khi `MODE = FULL`.

Đọc theo thứ tự:

```text
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
```

Từ `PROJECT_STATE.md`, xác định `CURRENT EXECUTION CONTEXT`, current work package,
current authoritative SSOT / Implementation Contract, implementation status và next gate.

Sau đó đọc đúng current authoritative SSOT / Implementation Contract và tài liệu task-specific cần thiết.
FULL không có nghĩa đọc toàn bộ repository.

## 4. Reconcile / Escalation Check

Nếu MODE = FOCUSED, xác minh tối thiểu:
- actual Git branch phù hợp declared task;
- applicable Contract path/section thực sự tồn tại;
- declared source/test/finding scope thực sự tồn tại;
- không có material pre-existing diff ngoài scope.

Nếu phát hiện escalation trigger:
1. ghi rõ `FOCUSED -> FULL`;
2. chuyển `MODE = FULL`;
3. thực hiện mục 3;
4. tiếp tục reconciliation theo FULL.

Nếu MODE = FULL, đối chiếu governance context với repo thực tế:
- actual branch/HEAD;
- relevant commit history khi task cần;
- authoritative files thực sự tồn tại;
- current Contract/SSOT path đúng;
- material repository drift có hay không.

Nếu có sai lệch đáng kể không giải được bằng authority hierarchy, áp dụng STOP CONDITION
tương ứng trong `AGENTS.md`.

## 5. Trả kết quả

Luôn bắt đầu:

```text
MODE: FOCUSED | FULL
REF: branch=<actual branch> HEAD=<actual SHA> tree=<CLEAN|DIRTY>
```

Sau đó:

```text
## STARTUP STATUS

Startup Protocol: PASS / BLOCKED
Repository: <tên repo>
Current branch: <actual branch>
HEAD: <actual sha>
Upstream HEAD: <sha / NONE / NOT CHECKED>

## CURRENT EXECUTION

Decision / Phase: ...
Work package: ...
Current task: ...
Applicable Contract: ...
Implementation status: ...
Next gate/action: ...

## VERIFIED FINDINGS

(chỉ liệt kê điều đã tự xác minh bằng Git/Read/Glob; không suy đoán)

## BLOCKERS / CONFLICTS

NONE hoặc liệt kê cụ thể.

## RECOMMENDED NEXT ACTION

(chỉ một hành động giá trị cao nhất tiếp theo)

## WRITE AUTHORIZATION

READ-ONLY — no repository changes made
```

Trong FOCUSED, field không cần cho declared scope và chưa được authoritatively xác minh thì ghi
`N/A — FOCUSED`, không tự discovery chỉ để điền report.

Không tự chuyển sang implementation ngay sau startup trừ khi Owner yêu cầu rõ trong cùng lượt,
và trước đó phải chạy `/gastrocare-dev:checkpoint-preflight` cho đúng task sắp làm.
