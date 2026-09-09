@AGENTS.md

# GastroCare — Claude Code Operating Notes

Nội dung trên `@AGENTS.md` là nguồn thẩm quyền chính (Startup Protocol, Authority
Hierarchy, Stop Conditions, Git Governance, Clinical Safety). Phần dưới đây chỉ
bổ sung các quy ước riêng cho Claude Code, không thay thế hay nới lỏng bất cứ
điều gì ở trên.

## Bắt buộc đầu mỗi session

Chạy `/gastrocare-dev:startup` trước khi đọc/sửa bất kỳ file nào khác; skill này phải tuân theo canonical FOCUSED/FULL Startup Protocol trong `AGENTS.md`, không duplicate hoặc tự diễn giải policy tại đây.

## Trước khi bắt đầu một checkpoint/task mới (Tn)

Chạy `/gastrocare-dev:checkpoint-preflight <Tn>` trước khi implement. Skill này
đọc đúng section liên quan trong Implementation Contract hiện hành, liệt kê
allowed/forbidden scope, và trả `READY FOR EXECUTION: YES/NO`.

## Sau khi hoàn tất một checkpoint

Chạy `/gastrocare-dev:project-verify <Tn>` trước khi báo cáo hoàn tất cho Owner (đây là skill
riêng của repo — KHÔNG phải bundled `/verify` có sẵn của Claude Code, vốn chỉ
build/run app; hai skill khác nhau và tồn tại song song). Skill `project-verify`
đối chiếu Contract vs code vs test vs diff (kể cả phần đã commit, không chỉ
uncommitted), trả verdict `PASS` / `PASS WITH FINDINGS` / `FAIL`. Đây **không
phải** independent audit — skill này do cùng session chạy, nên không được tự
nhận là Codex/independent verification. Nếu Contract yêu cầu independent audit
cho một task cụ thể (ví dụ concurrency/transaction), vẫn phải giao cho session
khác.

## Ranh giới cứng khi dùng Claude Code cho repo này

- Không tự quyết coi một Working Assumption đã thành Owner Decision.
- Không tự ghi `OWNER LOCKED`, `OWNER ACCEPTED`, hoặc bất kỳ trạng thái PASS nào
  vào `docs/PROJECT_STATE.md` / `docs/DECISION_LOG.md` mà chưa có xác nhận rõ
  từ Owner trong chính phiên làm việc.
- Không commit/push nếu Owner chưa cho phép rõ ràng cho đúng phạm vi đó (xem
  `.claude/settings.json` — các thao tác git ở mức `ask` sẽ tự dừng lại hỏi).
- Không sửa `backend/prisma/schema.prisma` hoặc thêm migration nếu Implementation
  Contract hiện hành ghi `NO PRISMA SCHEMA CHANGE` — hook `protect-schema` sẽ
  chặn và giải thích lý do.

## Vị trí tài liệu hay dùng

```
AGENTS.md
docs/PROJECT_STATE.md
docs/DECISION_LOG.md
docs/07_ROADMAP_AND_GATES.md
docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md
docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md
docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md
```

Danh sách này sẽ tăng theo dự án — skill `startup` luôn tự đọc
`docs/PROJECT_STATE.md → CURRENT EXECUTION CONTEXT` để biết SSOT nào đang là
authoritative, không dựa vào danh sách tĩnh này.

## Model routing gợi ý (không bắt buộc)

- Việc đọc/đối chiếu SSOT, viết test, implementation thông thường: giữ nguyên
  model của session hiện tại.
- Quyết định kiến trúc rủi ro cao (concurrency, migration, thay đổi domain
  invariant): cân nhắc dùng Plan Mode trước khi vào Execute.
- Không tự spawn nhiều subagent review song song cho một checkpoint thông
  thường — chỉ dùng khi Contract yêu cầu rõ (ví dụ gate concurrency riêng).
