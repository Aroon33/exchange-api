#!/usr/bin/env bash
set -e

cd /var/www/exchange-api

echo "=== Seed Trades (testuser) ==="

# ts-node なければ追加
if ! npx ts-node --version >/dev/null 2>&1; then
  echo "ts-node がありません。インストールします..."
  npm install --save-dev ts-node @types/node
fi

npx ts-node prisma/seed/seed_trades.ts

echo "=== Seed Trades 完了 ==="
