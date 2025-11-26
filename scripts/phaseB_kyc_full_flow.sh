#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== PhaseB KYC Full Flow デモ開始 ==="
echo "API_BASE = $API_BASE"

login_and_get_token() {
  local EMAIL="$1"
  local PASS="$2"

  echo ">> login: $EMAIL"

  local RES
  RES=$(curl -i -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

  echo "---- 応答ヘッダ＋ボディ（抜粋） ----"
  echo "$RES" | tail -n 5
  echo "----------------------------------"

  local TOKEN
  TOKEN=$(echo "$RES" | sed -n 's/^Set-Cookie: access_token=\([^;]*\);.*$/\1/p' | head -n1)

  if [ -z "$TOKEN" ]; then
    echo "!! access_token が取得できませんでした（login: $EMAIL）"
    exit 1
  fi

  echo "$TOKEN"
}

########################################
# 1. testuser ログイン
########################################
USER_TOKEN=$(login_and_get_token "testuser@example.com" "UserPass123!")
USER_AUTH="Authorization: Bearer $USER_TOKEN"
echo "USER_TOKEN 取得 OK"
echo ""

echo "[1] GET /kyc/status (user)"
curl -s "$API_BASE/kyc/status" -H "$USER_AUTH"
echo ""
echo "----"

echo "[2] POST /kyc/submit (user)"
curl -s -X POST "$API_BASE/kyc/submit" \
  -H "$USER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"level":2,"documentType":"driver_license"}'
echo ""
echo "----"

echo "[3] GET /kyc/status (user, after submit)"
curl -s "$API_BASE/kyc/status" -H "$USER_AUTH"
echo ""
echo "----"

########################################
# 2. admin ログイン
########################################
ADMIN_TOKEN=$(login_and_get_token "admin@example.com" "AdminStrongPass123!")
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"
echo "ADMIN_TOKEN 取得 OK"
echo ""

echo "[4] GET /kyc/admin/list (admin)"
curl -s "$API_BASE/kyc/admin/list" -H "$ADMIN_AUTH"
echo ""
echo "----"

echo "[5] POST /kyc/admin/set-status (admin, latest request APPROVED)"
curl -s -X POST "$API_BASE/kyc/admin/set-status" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","level":2,"addressStatus":"OK","idStatus":"OK"}'
echo ""
echo "----"

echo "[6] GET /kyc/status (user, after approved)"
curl -s "$API_BASE/kyc/status" -H "$USER_AUTH"
echo ""
echo "----"

echo "=== PhaseB KYC Full Flow デモ完了 ==="
