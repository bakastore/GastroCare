---
name: startup
description: Thực thi Startup Protocol của GastroCare (đọc AGENTS.md, PROJECT_STATE, DECISION_LOG, Roadmap, xác định branch/HEAD/task hiện tại) và trả STARTUP STATUS. Dùng đầu mỗi session, trước khi đọc/sửa bất kỳ file nào khác trong repo GastroCare.
disable-model-invocation: true
---

# GastroCare Startup

Chạy đúng trình tự sau. Đây là READ-ONLY — không sửa file nào trong skill này.

## 1. Git state

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git fetch origin --quiet
git rev-parse origin/$(git branch --show-current) 2>/dev/null
```

Nếu local HEAD khác remote HEAD của cùng branch, ghi rõ chênh lệch, không tự
giả định bên nào đúng.

Nếu `git status --short` không rỗng, liệt kê nguyên văn danh sách file — không
tự ý bỏ qua, không tự `git stash`/`git checkout` để "dọn sạch".

## 2. Đọc theo đúng thứ tự bắt buộc

```
AGENTS.md
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
```

Từ `PROJECT_STATE.md`, tìm section `CURRENT EXECUTION CONTEXT` (hoặc tên
tương đương gần nhất nếu file đã đổi cấu trúc — không suy đoán, nếu không tìm
thấy section này thì báo rõ trong BLOCKERS) để xác định:

- current branch được chỉ định (so với branch thực tế ở bước 1)
- current work package
- current authoritative SSOT / Implementation Contract
- implementation status
- next execution gate

## 3. Đọc SSOT/Contract tương ứng

Đọc đúng file được `PROJECT_STATE.md` chỉ định làm current authoritative SSOT
và Implementation Contract (nếu có). Không dùng ký ức từ session trước để thay
thế việc đọc lại — mỗi session phải tự bootstrap.

## 4. Đối chiếu

So sánh những gì `PROJECT_STATE.md` khai báo với thực tế:

- commit log thật (`git log --oneline <baseline>..HEAD`) có khớp mô tả không
- các file mà Contract/DECISION_LOG nói đã tồn tại có thật sự tồn tại không
  (dùng `Read`/`Glob`, không suy đoán từ tên)

Nếu có sai lệch đáng kể giữa PROJECT_STATE.md và thực tế repo, đây là STOP
CONDITION E (Repository drift) theo AGENTS.md — báo rõ trong BLOCKERS, không
tự ý chọn một bên để tin.

## 5. Trả kết quả — đúng format sau, không thêm bớt heading

```
## STARTUP STATUS

Startup Protocol: PASS / BLOCKED
Repository: <tên repo>
Current branch: <branch>
HEAD: <sha>
Remote HEAD: <sha hoặc "khớp local">
Baseline: <sha/tag liên quan>

## CURRENT EXECUTION

Phase: ...
Work package: ...
Current task: ...
Implementation status: ...
Next gate: ...

## VERIFIED FINDINGS

(chỉ liệt kê điều đã tự xác minh bằng git/Read/Glob ở trên — không suy đoán)

## BLOCKERS / CONFLICTS

NONE, hoặc liệt kê cụ thể (kèm STOP CONDITION nào áp dụng nếu có)

## RECOMMENDED NEXT ACTION

(chỉ một đề xuất checkpoint giá trị cao nhất tiếp theo)

## WRITE AUTHORIZATION

READ-ONLY — no repository changes made
```

Không tự chuyển sang implementation ngay sau bước này trừ khi người dùng yêu
cầu rõ trong cùng lượt, và trước đó phải chạy `/gastrocare-dev:checkpoint-preflight`
cho đúng task sắp làm.
