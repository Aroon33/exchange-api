#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== PhaseA Full Flow デモ開始 ==="
echo "API_BASE = $API_BASE"

########################################
# 共通: ログインして access_token を取得
########################################
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
# 1. testuser でログイン
########################################
USER_TOKEN=$(login_and_get_token "testuser@example.com" "UserPass123!")
USER_AUTH="Authorization: Bearer $USER_TOKEN"
echo "USER_TOKEN 取得 OK"
echo ""

########################################
# 2. /auth/me /wallet を確認
########################################
echo "[1] /auth/me (user)"
curl -s "$API_BASE/auth/me" -H "$USER_AUTH"
echo ""
echo "----"

echo "[2] /wallet (user, before deposit)"
curl -s "$API_BASE/wallet" -H "$USER_AUTH"
echo ""
echo "----"

########################################
# 3. 入金申請（100）
########################################
echo "[3] /deposit/request (user, amount=100)"
curl -s -X POST "$API_BASE/deposit/request" \
  -H "$USER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"amount":"100.00"}'
echo ""
echo "----"

########################################
# 4. admin でログイン
########################################
ADMIN_TOKEN=$(login_and_get_token "admin@example.com" "AdminStrongPass123!")
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"
echo "ADMIN_TOKEN 取得 OK"
echo ""

########################################
# 5. admin が /deposit/approve （id指定なし＝最新PENDINGを自動承認）
########################################
echo "[4] /deposit/approve (admin, latest pending)"
curl -s -X POST "$API_BASE/deposit/approve" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""
echo "----"

########################################
# 6. 再度 user で /wallet を確認（入金反映）
########################################
echo "[5] /wallet (user, after deposit approved)"
curl -s "$API_BASE/wallet" -H "$USER_AUTH"
echo ""
echo "----"

########################################
# 7. 出金申請（10）
########################################
echo "[6] /withdraw/request (user, amount=10)"
curl -s -X POST "$API_BASE/withdraw/request" \
  -H "$USER_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"amount":"10.00"}'
echo ""
echo "----"

########################################
# 8. 最後に /wallet を確認
########################################
echo "[7] /wallet (user, after withdraw request)"
curl -s "$API_BASE/wallet" -H "$USER_AUTH"
echo ""
echo "----"

echo "=== PhaseA Full Flow デモ完了 ==="
