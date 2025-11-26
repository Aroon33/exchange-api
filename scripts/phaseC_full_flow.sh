#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== PhaseC Group + System Stop Full Flow ==="

login() {
  local EMAIL="$1"
  local PASS="$2"

  local RES
  RES=$(curl -i -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

  TOKEN=$(echo "$RES" | sed -n 's/^Set-Cookie: access_token=\([^;]*\).*/\1/p' | head -n1)
  echo "$TOKEN"
}

# 1. user login
USER_TOKEN=$(login "testuser@example.com" "UserPass123!")
USER_AUTH="Authorization: Bearer $USER_TOKEN"

# 2. system stop request (user)
echo "[1] /system/stop (user)"
curl -s -X POST "$API_BASE/system/stop" -H "$USER_AUTH"
echo ""

# 3. admin login
ADMIN_TOKEN=$(login "admin@example.com" "AdminStrongPass123!")
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

# 4. admin issues stop-request
echo "[2] /system/admin/stop-request (admin)"
curl -s -X POST "$API_BASE/system/admin/stop-request" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"userId":4}'
echo ""

# 5. batch completes close-complete
echo "[3] /system/close-complete (batch)"
curl -s -X POST "$API_BASE/system/close-complete" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"userId":4}'
echo ""

# 6. admin changes group
echo "[4] /groups/change (admin)"
curl -s -X POST "$API_BASE/groups/change" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"userId":4,"groupId":1}'
echo ""

echo "=== PhaseC OK ==="
