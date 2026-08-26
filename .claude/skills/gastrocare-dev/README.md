# GastroCare Claude Code Governance Layer — DEV-TOOLING-01 (Final Candidate)

Round 2 chuyển hẳn sang **project-scoped skills-directory plugin thật**
(`gastrocare-dev@skills-dir`), sau khi xác nhận trực tiếp qua docs Claude Code
chính thức: *"A project-scope plugin is checked into the repository and
reaches every collaborator who clones it."* — đúng bài toán "áp dụng cho toàn
bộ dự án" mà anh cần, không cần marketplace/install step.

## 1. Cấu trúc

```
CLAUDE.md
.claude/settings.json                                — permission (KHÔNG chứa hooks nữa)
.claude/skills/gastrocare-dev/
├── .claude-plugin/plugin.json                        — manifest
├── skills/
│   ├── startup/SKILL.md
│   ├── checkpoint-preflight/SKILL.md
│   └── project-verify/SKILL.md
├── hooks/hooks.json                                  — dùng ${CLAUDE_PLUGIN_ROOT}
└── scripts/
    ├── protect-schema.sh
    └── privacy-scan.sh
```

Sau khi cài, lệnh dùng đúng namespace plugin:

```
/gastrocare-dev:startup
/gastrocare-dev:checkpoint-preflight <Tn>
/gastrocare-dev:project-verify <Tn>
```

## 2. Cài đặt — LƯU Ý QUAN TRỌNG

Copy nguyên cấu trúc trên vào root repo, giữ nguyên đường dẫn, rồi:

```bash
chmod +x .claude/skills/gastrocare-dev/scripts/*.sh
```

**Bắt buộc khởi động Claude Code từ đúng root repo:**

```bash
cd /path/to/GastroCare
claude
```

Project-scope skills-directory plugin **chỉ tự phát hiện từ `.claude/skills/`
của đúng thư mục nơi Claude được khởi chạy** — không tự đi ngược lên repo root
như Skill thường. Nếu anh (hoặc một cộng tác viên) mở Claude Code từ
`backend/` hay `frontend/`, plugin sẽ không load. Nếu lỡ đổi thư mục giữa
session, chạy `/reload-plugins`.

## Gate 0 — validate trước khi mở session

Trước khi mở Claude Code, validate manifest/hooks/frontmatter bằng chính
command Claude Code cung cấp:

```bash
claude plugin validate .claude/skills/gastrocare-dev --strict
```

`--strict` biến warning thành error — nên chạy bản này, không chỉ bản không
`--strict`, để bắt cả lỗi nhỏ (VD field đặt sai tên) trước khi tin tưởng.

## Xác nhận plugin đã load — đừng chỉ dựa vào một cách duy nhất

Em không tìm được nguồn đủ chắc chắn để khẳng định dứt khoát UI tương tác
`/plugin` (gõ trong session) có liệt kê đầy đủ skills-directory plugin hay
không — có tài liệu gợi ý khác biệt giữa `claude plugin list` (CLI, chạy
ngoài session) và trải nghiệm trong `/plugin`. Để không phụ thuộc vào một
lệnh có thể đang gây nhầm lẫn, xác nhận bằng **cả hai** cách sau, ưu tiên
cách 2 làm bằng chứng thật:

1. `claude plugin list` (chạy ngoài session, trong terminal) — nên thấy
   `gastrocare-dev@skills-dir`.
2. **Bằng chứng chắc chắn nhất:** mở session, gõ thẳng `/gastrocare-dev:startup`.
   Nếu chạy được (không báo "unknown command"), plugin chắc chắn đã load —
   đây là test có tính quyết định, không phụ thuộc UI nào.

## 3. Bắt buộc smoke-test trước khi commit

**a) Plugin có load không** — xem "Xác nhận plugin đã load" ở mục 2.

**b) Git guard** — yêu cầu Claude `git commit -am "test"` → dừng hỏi.

**c) Git branch read-only không bị hỏi oan** — yêu cầu Claude chạy
`git branch --show-current` → phải chạy thẳng, KHÔNG dừng hỏi (Round 1 có bug
khiến lệnh này bị `ask` chặn nhầm dù đã có trong `allow` — xem mục 5).

**d) Schema guard** — yêu cầu Claude sửa 1 dòng `backend/prisma/schema.prisma`.
Nếu Contract trong đúng section `CURRENT EXECUTION CONTEXT` của
`docs/PROJECT_STATE.md` ghi "NO PRISMA SCHEMA CHANGE"/"NO NEW MIGRATION" →
chặn cứng. Đã tự test bằng 2 kịch bản ngược nhau (Contract lịch sử cấm nhưng
Contract hiện hành cho phép, và ngược lại) — cả hai đều ra đúng kết quả.

**e) Lint không tự `--fix` âm thầm** — yêu cầu Claude chạy `npm run lint` ở
`backend/` → phải dừng hỏi trước (script này có `--fix`, tự sửa source).

**f) Privacy guard** — thêm `phone: "0912345678"` và `phone: 0912345678` (cả
hai dạng) vào file trong `backend/test/` → cả hai phải khiến Claude dừng hỏi.

**g) Tự sửa cấu hình** — yêu cầu Claude sửa `.claude/settings.json` hoặc file
trong `.claude/skills/gastrocare-dev/` → phải dừng hỏi.

Nếu cả 7 đúng kỳ vọng, mới `git add` + commit riêng cho `DEV-TOOLING-01`.

## 4. Giới hạn đã biết (đã verify, không suy đoán)

- `protect-schema.sh`/`privacy-scan.sh` là heuristic text-matching, không phải
  parser/PII-detector chuẩn.
- Hook chỉ bắt tool `Edit|Write`. Nếu Claude dùng `Bash` để sửa file trực tiếp
  (VD script Python tự `open(..., "w")`), hook không chạy — theo đúng docs
  Claude Code: quy tắc theo tool-matcher không áp được cho subprocess tùy ý.
  Đây là **best-effort governance guard**, không phải hardened security
  boundary. Nếu cần chặn tuyệt đối, cần thêm sandbox/filesystem policy ở tầng
  hệ điều hành — nằm ngoài phạm vi v0.2 này.
- Đã xác nhận `Write(...)` là path rule **không đáng tin cậy** trong permission
  engine hiện tại (nhiều báo cáo cho thấy nó bị "chấp nhận nhưng không bao giờ
  được tham chiếu" trong một số phiên bản/tình huống) — chỉ dùng `Edit(...)`,
  vốn bao phủ mọi tool chỉnh sửa file.
- `disable-model-invocation: true` trong 3 Skill là field chính thức, đúng ý
  nghĩa "chỉ user gọi được qua `/tên-lệnh`, model không tự động gọi". Tuy
  nhiên đã có báo cáo lỗi (một số issue trên repo anthropics/claude-code, số
  hiệu cụ thể thay đổi theo thời gian nên không trích ở đây để tránh dẫn nhầm)
  mô tả việc field này đôi khi khiến cả việc gọi thủ công cũng bị chặn ở một
  số phiên bản. Nếu gặp, xoá dòng này khỏi frontmatter.
- Thay đổi nội dung `SKILL.md` áp dụng ngay trong session hiện tại (đã xác
  nhận rõ, nhiều nguồn đồng nhất). Thay đổi trong `hooks/`, `.mcp.json`,
  `agents/` của **plugin** thì cần `/reload-plugins` hoặc restart — điều này
  giờ chắc chắn, vì hook đã chuyển hẳn vào cấu trúc plugin (khác giai đoạn
  Round 1 khi hook còn nằm trực tiếp trong `settings.json` và có thông tin
  trái chiều giữa các nguồn về việc có cần restart hay không).

## 5. Nhật ký sửa lỗi Round 2

Tự test/verify từng điểm bằng script thật hoặc tra cứu trực tiếp docs, không
chỉ tin lời review:

| # | Vấn đề | Xác nhận bằng | Fix |
|---|---|---|---|
| 1 | Chưa phải plugin thật, dùng standalone | Tra lại docs — nay xác nhận rõ project-scope skills-directory plugin "reaches every collaborator who clones it" | Chuyển cấu trúc sang `.claude/skills/gastrocare-dev/` + `plugin.json` |
| 2 | `protect-schema.sh` grep toàn bộ `PROJECT_STATE.md`, không scope đúng section | Tự đọc lại code — xác nhận đúng; tự dựng 2 kịch bản Contract lịch sử vs hiện hành khác nhau, script cũ ra sai | Viết lại dùng `awk` trích đúng khối `CURRENT EXECUTION CONTEXT`, test lại đúng cả 2 chiều |
| 3 | `Bash(git branch *)` trong `ask` đè mất các `allow` hẹp hơn (`--show-current`, `-a`, `-r`) | Tra lại docs permissions: "deny, then ask, then allow... rule specificity doesn't change the order" — nghĩa là toàn bộ category `ask` được xét trước toàn bộ category `allow`, không liên quan độ cụ thể | Bỏ `Bash(git branch *)` khỏi `ask`; các form list/show-current giữ `allow`; form tạo/xoá branch không khớp allow nào sẽ tự rơi về default-ask |
| 4 | `npm run lint *` nằm trong `allow` nhưng script backend có `--fix` (tự sửa source) | Đọc trực tiếp `backend/package.json` — xác nhận đúng: `"lint": "eslint ... --fix"` | Chuyển `npm run lint *` sang `ask` |
| 5 | Hook có thể bị bypass qua Bash | Đúng, đã ghi nhận từ Round 1 | Đổi cách diễn đạt: "best-effort governance guard", không gọi là "hard guard" |
| 6 | 3 SKILL.md còn lẫn lộn tên lệnh `/gastrocare-dev:*` và tên standalone | Grep lại toàn bộ file — xác nhận đúng, đã đồng bộ | Giờ TẤT CẢ dùng đúng `/gastrocare-dev:*` vì đã là plugin thật |
| 7 | `Write(/.claude/**)` không hiệu lực | Tra cứu — có báo cáo thật (nhiều issue độc lập) cho thấy `Write(...)` path rule không đáng tin, kể cả tài liệu chính thức cũng có mâu thuẫn nội bộ về điểm này | Bỏ hẳn, chỉ giữ `Edit(/.claude/**)` |
| 8, 9 | Câu chữ README về reload/issue number | Có tín hiệu trái chiều giữa các nguồn (không giải quyết dứt khoát được) | Viết lại thận trọng hơn — không khẳng định chắc như một phía, không trích số issue cụ thể (số hiệu dễ đổi/khó xác minh) |

## 6. Nhật ký sửa lỗi Round 3

Tự test lại bằng bash thật trước khi tin, không chỉ tin lời review:

| # | Vấn đề | Xác nhận bằng | Fix |
|---|---|---|---|
| B1 | README dựa vào `/plugin list` để xác nhận plugin load | Không tìm đủ nguồn chắc chắn cho riêng khác biệt UI `/plugin` vs CLI `claude plugin list` — thay vì đoán, đổi sang không phụ thuộc 1 lệnh | Thêm Gate 0 `claude plugin validate --strict`; xác nhận load bằng CLI + chạy thẳng `/gastrocare-dev:startup` làm bằng chứng quyết định |
| B2 | `${CLAUDE_PLUGIN_ROOT}` không quote trong `hooks.json`, gãy nếu path có khoảng trắng | Tự test bằng bash: path `"/tmp/plugin root test"` — bản không quote ra lỗi `No such file or directory` (rc khác 0); bản quote chạy đúng (rc=0). Test lại bằng chính command lấy từ JSON sau khi sửa — xác nhận PASS | Bọc `"${CLAUDE_PLUGIN_ROOT}"` trong dấu ngoặc kép ở cả 2 dòng `command` |

## 7. Nhật ký sửa lỗi — Micro-fix cuối

| Vấn đề | Xác nhận bằng | Fix |
|---|---|---|
| `protect-schema.sh` resolve đúng tên Contract từ `CURRENT EXECUTION CONTEXT` nhưng sau đó lại `find -iname "*basename"` — fuzzy match có thể chọn nhầm file khác cùng hậu tố tên (VD `OLD_CURRENT_...md` khớp nhầm thay vì `CURRENT_...md`) | Tự dựng lại đúng kịch bản (2 file, 1 file là tiền tố của file kia) — xác nhận bug thật: script chặn nhầm dù Contract hiện hành cho phép migration. Test lại sau fix với đúng 3 case (exact đúng, đảo vai, Contract missing) + re-test trên `PROJECT_STATE.md`/Contract THẬT của repo Slice 2 (vẫn block đúng) | Bỏ `find`, dùng thẳng exact path `$REPO_ROOT/$CONTRACT_NAME`; nếu path không tồn tại → `ask` với lý do Repository Drift, không tự đoán file thay thế |

## 8. Sau khi commit

Dùng `/gastrocare-dev:startup` đầu mỗi session, `/gastrocare-dev:checkpoint-preflight <Tn>`
trước mỗi task, `/gastrocare-dev:project-verify <Tn>` sau khi implement xong.


## 7. Final micro-fix — discovery/no-contract safety

`protect-schema.sh` dùng `set -euo pipefail`. Các pipeline trích `file_path`,
`Implementation Contract` và tên contract có thể không match ở trạng thái hợp lệ
(discovery-only/chưa có contract). Nếu không có `|| true`, `grep` trả exit 1 và script
thoát sớm trước khi tới nhánh xử lý dự kiến. Final Candidate thêm `|| true` cho ba
command substitution này.

Kỳ vọng sau fix:

- Current Contract cấm schema/migration → BLOCK (`exit 2`).
- Current Contract cho phép → ALLOW (`exit 0`).
- Contract được chỉ định nhưng missing → `ask` với Repository Drift.
- Có `CURRENT EXECUTION CONTEXT` nhưng chưa có Contract row → ALLOW (`exit 0`).
- `Implementation Contract = NONE` → ALLOW (`exit 0`).
