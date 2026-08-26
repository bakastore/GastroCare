#!/usr/bin/env bash
# PreToolUse hook — matcher: Edit|Write
#
# Mục tiêu: nếu Implementation Contract HIỆN HÀNH được ghi trong đúng section
# "CURRENT EXECUTION CONTEXT" của docs/PROJECT_STATE.md ghi "NO PRISMA SCHEMA
# CHANGE" / "NO NEW MIGRATION", chặn cứng (exit 2) việc sửa
# backend/prisma/schema.prisma hoặc backend/prisma/migrations/**.
#
# Lịch sử sửa lỗi (đã tự test từng bản trước khi commit):
#   v1: chọn Contract theo `ls -t` (mtime) -> SAI, Contract cũ bị touch sau
#       vẫn được chọn làm authoritative. Đã tự dựng lại kịch bản và xác nhận.
#   v2: grep tên Contract trên TOÀN BỘ PROJECT_STATE.md -> SAI, một Contract
#       lịch sử được nhắc ở section khác (VD "Vertical Slice 2 authority: ...")
#       có thể lẫn vào danh sách candidate và gây block oan dù CURRENT EXECUTION
#       CONTEXT đang trỏ Contract khác. Đã tự kiểm tra trên PROJECT_STATE.md
#       thật của repo và xác nhận có nhiều dòng nhắc lại cùng/khác Contract
#       ngoài section 7.
#   v3 (bản này): CHỈ đọc trong đúng khối text từ heading "CURRENT EXECUTION
#       CONTEXT" đến hết file (hoặc đến heading "## " cùng cấp tiếp theo nếu
#       có), rồi mới tìm dòng "Implementation Contract" trong khối đó.
#
# Đây vẫn là heuristic đọc text theo đúng format bảng hiện tại của
# PROJECT_STATE.md ("| Implementation Contract | `path` ... |"). Nếu format
# bảng đổi, cập nhật lại phần trích xuất bên dưới.

set -euo pipefail

INPUT_JSON="$(cat)"

FILE_PATH="$(echo "$INPUT_JSON" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/' || true)"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *backend/prisma/schema.prisma|*backend/prisma/migrations/*)
    ;;
  *)
    exit 0
    ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_STATE="$REPO_ROOT/docs/PROJECT_STATE.md"

if [ ! -f "$PROJECT_STATE" ]; then
  exit 0
fi

# Trích đúng khối "CURRENT EXECUTION CONTEXT": từ heading đó (bất kể số thứ tự
# mục, VD "## 7. CURRENT EXECUTION CONTEXT") đến hết file, vì đây luôn là
# section cuối theo quy ước hiện tại của PROJECT_STATE.md. Nếu sau này có
# heading "## " khác xuất hiện SAU nó, awk sẽ dừng đúng tại đó.
SECTION_TEXT="$(awk '
  /^## [0-9]+\. CURRENT EXECUTION CONTEXT/ { found=1; print; next }
  found && /^## / { exit }
  found { print }
' "$PROJECT_STATE")"

if [ -z "$SECTION_TEXT" ]; then
  # Không tìm thấy section CURRENT EXECUTION CONTEXT -> không đủ căn cứ tự
  # block, nhưng đây là dấu hiệu drift đáng lo (đúng STOP CONDITION E) -> ask.
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "protect-schema: khong tim thay section 'CURRENT EXECUTION CONTEXT' trong docs/PROJECT_STATE.md. Day co the la Repository Drift (STOP CONDITION E theo AGENTS.md). Owner xac nhan thu cong truoc khi sua $FILE_PATH."
  }
}
EOF
  exit 0
fi

CONTRACT_LINE="$(echo "$SECTION_TEXT" | grep -iE '\|[[:space:]]*Implementation Contract[[:space:]]*\|' | head -1 || true)"

if [ -z "$CONTRACT_LINE" ]; then
  # Section tồn tại nhưng không có dòng "Implementation Contract" -> có thể
  # đang ở giai đoạn discovery-only, không có Contract nào active. Không
  # block, để ask xử lý qua settings.json bình thường.
  exit 0
fi

CONTRACT_NAME="$(echo "$CONTRACT_LINE" | grep -oE '[A-Za-z0-9_/.-]*IMPLEMENTATION_CONTRACT[A-Za-z0-9_.-]*\.md' | head -1 || true)"

if [ -z "$CONTRACT_NAME" ]; then
  exit 0
fi

# Sửa sau review round 3: bản trước dùng
#   find "$REPO_ROOT/docs" -maxdepth 1 -iname "*$(basename "$CONTRACT_NAME")"
# — tức fuzzy match theo basename, không phải exact path. Đã tự dựng lại
# đúng kịch bản (docs/OLD_CURRENT_IMPLEMENTATION_CONTRACT.md tồn tại song
# song với docs/CURRENT_IMPLEMENTATION_CONTRACT.md, PROJECT_STATE trỏ đúng
# file sau) và xác nhận bug thật: `find -iname "*CURRENT_..."` khớp cả hai
# file vì dấu `*` chấp nhận mọi tiền tố, và có thể chọn nhầm file OLD_.
# Authority đã được resolve chính xác ở bước trên (CURRENT_NAME lấy đúng từ
# CURRENT EXECUTION CONTEXT) nhưng bước match file lại làm mất độ chính xác
# đó. Bản này dùng thẳng exact path, không match mờ theo tên.
MATCH="$REPO_ROOT/$CONTRACT_NAME"

if [ ! -f "$MATCH" ]; then
  # Contract được CURRENT EXECUTION CONTEXT chỉ định nhưng không tồn tại
  # đúng path đó -> đây là Repository Drift (STOP CONDITION E theo
  # AGENTS.md), không tự suy đoán file nào khác thay thế.
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "protect-schema: Implementation Contract duoc CURRENT EXECUTION CONTEXT chi dinh ($CONTRACT_NAME) khong ton tai dung tai path do. Co the la Repository Drift (STOP CONDITION E theo AGENTS.md). Owner xac nhan truoc khi sua $FILE_PATH."
  }
}
EOF
  exit 0
fi

if grep -qiE "NO[[:space:]]+PRISMA[[:space:]]+SCHEMA[[:space:]]+CHANGE|NO[[:space:]]+NEW[[:space:]]+MIGRATION|NO[[:space:]]+DATABASE[[:space:]]+MIGRATION" "$MATCH"; then
  echo "BLOCKED: $MATCH (Contract dan tu docs/PROJECT_STATE.md -> CURRENT EXECUTION CONTEXT) hien ghi ro NO PRISMA SCHEMA CHANGE / NO NEW MIGRATION. Sua $FILE_PATH bi chan. Neu thuc su can migration, day la STOP CONDITION D (Dangerous migration) theo AGENTS.md - dung, bao Owner." >&2
  exit 2
fi

exit 0
