#!/usr/bin/env bash
set -e

API_BASE="${API_BASE:-http://localhost:3000}"

echo "=== PhaseA Smoke Test 開始（Bearer トークン）==="
echo "API_BASE = $API_BASE"

# 1. テストユーザーでログイン（ヘッダ＋ボディを取得）
echo "[1/6] /auth/login (testuser)"
LOGIN_RAW=$(curl -i -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"UserPass123!"}')

echo "HTTP 応答ヘッダ＋ボディ:"
echo "$LOGIN_RAW"
echo "----"

# 2. Set-Cookie から access_token をパースして Authorization 用に使う
ACCESS_TOKEN=$(echo "$LOGIN_RAW" | sed -n 's/^Set-Cookie: access_token=\([^;]*\);.*$/\1/p' | head -n1)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "access_token が Set-Cookie から取得できませんでした。"
  exit 1
fi

echo "ACCESS_TOKEN 抜き出し OK"
# echo "ACCESS_TOKEN = $ACCESS_TOKEN"  # デバッグしたければコメント解除

AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"

# 3. /auth/me
echo "[2/6] /auth/me"
curl -s "$API_BASE/auth/me" \
  -H "$AUTH_HEADER"
echo ""
echo "----"

# 4. /wallet
echo "[3/6] /wallet"
curl -s "$API_BASE/wallet" \
  -H "$AUTH_HEADER"
echo ""
echo "----"

# 5. deposit request
echo "[4/6] /deposit/request"
curl -s -X POST "$API_BASE/deposit/request" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"amount":"100.00"}'
echo ""
echo "----"

# 6. withdraw request（少額）
echo "[5/6] /withdraw/request"
curl -s -X POST "$API_BASE/withdraw/request" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"amount":"10.00"}'
echo ""
echo "----"

# 7. /wallet 再確認（残高の変化チェック）
echo "[6/6] /wallet (After deposit/withdraw request)"
curl -s "$API_BASE/wallet" \
  -H "$AUTH_HEADER"
echo ""
echo "----"

echo "=== PhaseA Smoke Test 完了 ==="
