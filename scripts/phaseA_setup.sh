#!/usr/bin/env bash
set -e

echo "=== PhaseA Setup: 依存関係インストール & Prisma 準備 ==="

cd "$(dirname "$0")/.."

# 1. 依存関係インストール（初回 or 変更時）
if [ ! -d node_modules ]; then
  echo "[1/3] npm install を実行します..."
  npm install
else
  echo "[1/3] node_modules は既に存在します。npm install はスキップします。"
fi

# 2. Prisma マイグレーション適用
echo "[2/3] Prisma migrate deploy を実行します..."
npx prisma migrate deploy

# 3. Prisma Client 生成
echo "[3/3] Prisma client を生成します..."
npx prisma generate

echo "=== PhaseA Setup 完了 ==="
