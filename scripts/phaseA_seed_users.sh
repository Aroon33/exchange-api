#!/usr/bin/env bash
set -e

echo "=== PhaseA Seed 実行 (Admin / User / Wallet) ==="

cd "$(dirname "$0")/.."

# ts-node が無い場合はインストール
if ! npx ts-node --version >/dev/null 2>&1; then
  echo "ts-node が見つかりません。devDependencies に追加します..."
  npm install --save-dev ts-node @types/node
fi

npx ts-node prisma/seed/phaseA_seed_users.ts

echo "=== PhaseA Seed 完了 ==="
