#!/usr/bin/env bash
# PreToolUse hook — matcher: Edit|Write
#
# KHÔNG auto-block. Trả permissionDecision "ask" khi nghi ngờ dữ liệu thật
# trong file test/e2e/seed/fixture. Đây là regex heuristic, không phải PII
# detector đầy đủ.
#
# Sửa sau review: bản trước dùng `grep -qE '"0[0-9]{9}"'` — đòi hỏi dấu `"`
# nằm sát ngay cạnh chuỗi số trong RAW JSON bytes. Nhưng nội dung file đi qua
# tool_input (VD field "content" của Write) được JSON-escape, nên số điện
# thoại nằm trong source code thực tế xuất hiện dạng \"0912345678\" (có dấu
# backslash chen giữa) hoặc không có quote nào cả (nếu là number literal/biến
# không quote trong code). Đã tự test bằng payload thật và xác nhận bản cũ bỏ
# lọt. Bản này chỉ dựa vào ranh giới không-phải-chữ-số, không đòi quote cụ thể.

set -euo pipefail

INPUT_JSON="$(cat)"

FILE_PATH="$(echo "$INPUT_JSON" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/')"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *test*|*e2e*|*seed*|*fixture*|*docs*)
    ;;
  *)
    exit 0
    ;;
esac

FINDINGS=""

# So dien thoai VN dang 10 so bat dau bang 0, ranh gioi la ky tu khong phai
# chu so (khong doi hoi dau quote cu the vi JSON escape lam bien dang quote).
if echo "$INPUT_JSON" | grep -qE '[^0-9]0[0-9]{9}[^0-9]'; then
  FINDINGS="${FINDINGS}so_dien_thoai_10_so;"
fi

# Chuoi 9 hoac 12 chu so lien nhau gan tu khoa CCCD/CMND/ID
if echo "$INPUT_JSON" | grep -qE '[^0-9][0-9]{9}([0-9]{3})?[^0-9]' && \
   echo "$INPUT_JSON" | grep -qiE 'cccd|cmnd|identity|idcard|so_cmnd|national_id'; then
  FINDINGS="${FINDINGS}chuoi_so_giong_cccd_cmnd;"
fi

# Email khong thuoc domain an toan dung cho synthetic/test data
EMAILS="$(echo "$INPUT_JSON" | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' || true)"
if [ -n "$EMAILS" ]; then
  if echo "$EMAILS" | grep -qviE '@(example\.(com|test|org)|test\.local|gastrocare\.test)$'; then
    FINDINGS="${FINDINGS}email_ngoai_domain_an_toan;"
  fi
fi

if [ -z "$FINDINGS" ]; then
  exit 0
fi

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "privacy-scan phat hien pattern nghi ngo ($FINDINGS) trong $FILE_PATH. Co the la synthetic data hop le (false positive) - Owner xem qua truoc khi cho phep ghi. Theo AGENTS.md, du lieu benh nhan that khong duoc vao Git/seed/test/fixture."
  }
}
EOF

exit 0
