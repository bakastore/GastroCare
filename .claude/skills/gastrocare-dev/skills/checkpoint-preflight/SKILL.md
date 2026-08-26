---
name: checkpoint-preflight
description: Preflight bắt buộc trước khi implement bất kỳ checkpoint/task nào (VD T4, T7) trong một Implementation Contract của GastroCare. Đọc đúng section liên quan, xác định allowed/forbidden scope, trả READY FOR EXECUTION YES/NO. Dùng ngay trước khi bắt đầu code cho một task cụ thể, sau khi đã chạy /gastrocare-dev:startup.
disable-model-invocation: true
argument-hint: "[task-id, ví dụ T4 hoặc T7]"
---

# Checkpoint Preflight

Input: một task id (VD `T4`, `T7`). Nếu người dùng không cung cấp, hỏi lại
đúng một câu để xác định task nào — không tự đoán.

READ-ONLY toàn bộ skill này.

## 1. Xác định Contract hiện hành

Dùng kết quả `/gastrocare-dev:startup` gần nhất trong session (nếu chưa chạy,
chạy lại trước). Mở đúng file Implementation Contract mà `PROJECT_STATE.md`
đang chỉ định là authoritative.

## 2. Trích đúng phần liên quan tới task

Từ Contract, trích:

- mục tiêu của task này
- allowed files/domain (phạm vi được sửa)
- forbidden scope (điều tuyệt đối không được làm ở task này)
- acceptance criteria / gate của riêng task này
- test bắt buộc (bao gồm negative test, concurrency test nếu Contract có nêu)
- có yêu cầu independent audit riêng cho task này không (VD do rủi ro
  concurrency/transaction cao) — nếu có, ghi rõ để không tự nhận task này là
  "xong" chỉ bằng self-review

## 3. Kiểm tra điều kiện bắt đầu

Task chỉ được bắt đầu nếu tất cả đúng:

- Contract cho task này đang ở trạng thái OWNER LOCKED (không phải DRAFT/PROPOSED)
- task liền trước (nếu Contract có thứ tự bắt buộc, VD sequence T1→T2→T3) đã
  đạt gate PASS — kiểm tra bằng bằng chứng thật (file/test/commit), không tin
  suông một dòng ghi chú
- không có unresolved Owner question nào chặn đúng task này
- working tree: KHÔNG bắt buộc phải sạch tuyệt đối (AGENTS.md không yêu cầu
  điều này). Yêu cầu thật là **known + reconciled**: nếu `git status --short`
  không rỗng, phải xác định rõ mỗi file đang dở dang đó là gì và vì sao còn
  đó (VD: WIP hợp lệ từ task trước, đã biết) — nếu không giải thích được rõ,
  hoặc nó có vẻ chồng lấn với baseline đã accepted, thì đó là lúc dừng và hỏi,
  không phải "hễ bẩn là chặn"

## 4. Trả kết quả

```
## CHECKPOINT PREFLIGHT — <task-id>

Contract: <file>, trạng thái: OWNER LOCKED / DRAFT / khác
Prerequisite task: PASS / chưa đủ bằng chứng / N/A

SCOPE ALLOWED:
- ...

SCOPE FORBIDDEN:
- ...

MANDATORY TESTS:
- ...

INDEPENDENT AUDIT REQUIRED CHO TASK NÀY: YES/NO (lý do nếu YES)

READY FOR EXECUTION: YES / NO
(nếu NO, nêu đúng blocker cụ thể — không mơ hồ)
```

Nếu `READY FOR EXECUTION: NO`, dừng lại chờ người dùng xử lý blocker, không
tự ý "cứ làm phần chưa bị chặn".
