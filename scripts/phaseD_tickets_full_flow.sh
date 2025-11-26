#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== PhaseD Tickets Full Flow ==="

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

echo "[1] user: POST /tickets (新規チケット作成)"
CREATE_RES=$(curl -s -X POST "$API_BASE/tickets" \
  -H "$USER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"title":"デモ問い合わせ","message":"最初の質問です。"}')
echo "$CREATE_RES"
echo "----"

TICKET_ID=$(echo "$CREATE_RES" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p' | head -n1)

if [ -z "$TICKET_ID" ]; then
  echo "!! TICKET_ID が取得できませんでした。"
  exit 1
fi

echo "TICKET_ID = $TICKET_ID"
echo "----"

echo "[2] user: GET /tickets"
curl -s "$API_BASE/tickets" -H "$USER_AUTH"
echo ""
echo "----"

echo "[3] user: GET /tickets/$TICKET_ID/messages"
curl -s "$API_BASE/tickets/$TICKET_ID/messages" -H "$USER_AUTH"
echo ""
echo "----"

echo "[4] user: POST /tickets/$TICKET_ID/reply"
curl -s -X POST "$API_BASE/tickets/$TICKET_ID/reply" \
  -H "$USER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"message":"ユーザー側からの追伸です。"}'
echo ""
echo "----"

# 2. admin login
ADMIN_TOKEN=$(login "admin@example.com" "AdminStrongPass123!")
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

echo "[5] admin: GET /tickets/admin/all"
curl -s "$API_BASE/tickets/admin/all" -H "$ADMIN_AUTH"
echo ""
echo "----"

echo "[6] admin: POST /tickets/admin/$TICKET_ID/reply"
curl -s -X POST "$API_BASE/tickets/admin/$TICKET_ID/reply" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"message":"管理側からの返信です。"}'
echo ""
echo "----"

echo "[7] admin: POST /tickets/admin/$TICKET_ID/status (CLOSED)"
curl -s -X POST "$API_BASE/tickets/admin/$TICKET_ID/status" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"status":"CLOSED"}'
echo ""
echo "----"

echo "[8] user: GET /tickets/$TICKET_ID/messages (final)"
curl -s "$API_BASE/tickets/$TICKET_ID/messages" -H "$USER_AUTH"
echo ""
echo "----"

echo "=== PhaseD OK ==="
