#!/bin/bash

echo "=== NestJS PrismaModule Import Checker ==="
echo

ROOT_DIR="./src"

# すべての service を検索（PrismaService を使っている service）
services=$(grep -Rl "PrismaService" "$ROOT_DIR" | grep "service.ts")

if [ -z "$services" ]; then
  echo "PrismaService を使う service が見つかりません。"
  exit 0
fi

echo "PrismaService を使っているサービス一覧:"
echo "$services"
echo

echo "=== モジュールの import 状態チェック ==="
echo

for service in $services; do
  module_file=$(echo "$service" | sed 's/service.ts/module.ts/')

  if [ ! -f "$module_file" ]; then
    echo "⚠ モジュールファイルが見つかりません: $module_file"
    continue
  fi

  echo "→ $module_file を確認中..."

  # PrismaModule が import されているか？
  if grep -q "PrismaModule" "$module_file"; then
    echo "   ✔ PrismaModule が import されています。"
  else
    echo "   ❌ PrismaModule が import されていません！"
  fi

  echo
done
