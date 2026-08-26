---
name: project-verify
description: Đối soát một checkpoint/task GastroCare (VD T4, T7) vừa implement xong với Implementation Contract — kiểm Contract vs code vs test vs diff (kể cả đã commit) vs scope — trả verdict PASS / PASS WITH FINDINGS / FAIL. Không phải independent audit. Dùng sau khi implement xong một task, trước khi báo Owner là hoàn tất. KHÔNG PHẢI bundled /verify của Claude Code (skill đó chỉ build/run app) — skill này kiểm Contract compliance.
disable-model-invocation: true
argument-hint: "[task-id]"
---

# Verify

Input: task id vừa implement (VD `T4`). Nếu không có, hỏi lại.

## Nguyên tắc bắt buộc trước khi chạy

Skill này chạy trong cùng session vừa implement (hoặc một session khác đọc
lại code). Dù chạy ở session nào, **kết quả của skill này không được gọi là
"independent audit" hay "Codex audit"** trong báo cáo cuối — chỉ được gọi là
`self-verification` (nếu cùng session vừa code) hoặc `second-session review`
(nếu là session khác nhưng vẫn dùng Claude, không phải Codex/agent độc lập
thật). Nếu Contract yêu cầu independent audit cho task này (xem kết quả
`checkpoint-preflight`), skill này KHÔNG thay thế yêu cầu đó.

## 1. Đọc lại Contract cho đúng task

Trích acceptance criteria, negative test list, scope exclusions của task này.

## 2. Đối chiếu Code

Với mỗi acceptance criterion, tìm bằng chứng thật trong code (đọc file, không
suy đoán từ tên hàm). Với mỗi item, ghi rõ:

- criterion
- bằng chứng (file:line hoặc mô tả cụ thể)
- PASS / FAIL / KHÔNG TÌM THẤY BẰNG CHỨNG

## 3. Đối chiếu Test

Chạy (hoặc yêu cầu chạy) đúng bộ test Contract quy định cho task này. Ghi lại
lệnh, kết quả pass/fail thật — không bịa số liệu. Nếu không thể tự chạy test
trong môi trường hiện tại, ghi rõ `KHÔNG THỂ TỰ CHẠY — cần người dùng chạy và
dán kết quả`, không giả định PASS.

## 4. Đối chiếu Git diff vs Scope

Task có thể đã được commit rồi (working tree sạch) — không được kết luận
"không có gì thay đổi" chỉ vì `git diff` rỗng. Phải resolve đúng baseline của
checkpoint này trước (từ Contract hoặc từ commit trước đó do
`checkpoint-preflight` ghi lại), rồi:

```bash
git status --short
git diff
git diff --cached
git diff <checkpoint-baseline-sha>..HEAD --stat
git diff <checkpoint-baseline-sha>..HEAD --check
```

Nếu không xác định được `<checkpoint-baseline-sha>` một cách chắc chắn (không
suy đoán), báo rõ trong finding và hỏi lại thay vì tự chọn một baseline.

Với mỗi file bị thay đổi (dù đã commit hay chưa), xác nhận nó nằm trong "SCOPE
ALLOWED" đã xác định ở bước `checkpoint-preflight`. Nếu có file ngoài scope,
đây là finding, không tự bỏ qua dù thay đổi có vẻ "vô hại".

Kiểm tra riêng: nếu Contract ghi `NO PRISMA SCHEMA CHANGE`, xác nhận
`backend/prisma/schema.prisma` và `backend/prisma/migrations/**` không nằm
trong diff.

## 5. Privacy sanity check

Grep nhanh các file mới/sửa trong `test/`, `e2e/`, `seed*` để tìm pattern
giống dữ liệu thật (số điện thoại 10 số bắt đầu bằng 0, chuỗi 9-12 chữ số gần
từ khóa CCCD/CMND, tên người Việt đầy đủ gắn với thông tin liên hệ cụ thể).
Đây là kiểm tra sanity nhanh, không thay thế hook `privacy-scan`.

## 6. Trả kết quả

```
## VERIFICATION — <task-id>

Method: self-verification / second-session review (KHÔNG PHẢI independent audit)

CONTRACT CRITERIA:
1. <criterion> — PASS/FAIL/NO EVIDENCE — <bằng chứng>
...

TESTS:
<lệnh> — <kết quả thật, hoặc "KHÔNG THỂ TỰ CHẠY">

DIFF VS SCOPE:
<file> — trong scope / NGOÀI SCOPE

SCHEMA/MIGRATION CHANGE: NONE / CÓ (nếu Contract cấm mà vẫn có → FAIL ngay)

PRIVACY SANITY: PASS / CẦN XEM LẠI <file>

VERDICT: PASS / PASS WITH FINDINGS / FAIL

FINDINGS (nếu có):
F1 — ...

INDEPENDENT AUDIT STILL REQUIRED: YES/NO (theo kết quả checkpoint-preflight)
```

Không tự nâng verdict lên PASS nếu có bất kỳ mục nào ghi FAIL hoặc NO EVIDENCE.
