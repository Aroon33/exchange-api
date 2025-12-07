#!/bin/bash

echo "=== PrismaModule 自動挿入スクリプト ==="

TARGETS=(
  "./src/kyc/kyc.module.ts"
  "./src/tickets/tickets.module.ts"
  "./src/groups/groups.module.ts"
)

for file in "${TARGETS[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠ ファイルが存在しません: $file"
    continue
  fi

  echo "→ 修正中: $file"

  # すでに import されているかチェック
  if grep -q "PrismaModule" "$file"; then
    echo "   ✔ 既に PrismaModule が import 済み。スキップ。"
    continue
  fi

  # import 文を追加（最初の import 群の後）
  sed -i "/^import /a import { PrismaModule } from '../prisma/prisma.module';" "$file"

  # Module デコレータの imports: に追加
  if grep -q "imports:" "$file"; then
    # imports: [ ... ] の中に PrismaModule を追加
    sed -i "s/imports: \[/imports: [PrismaModule, /" "$file"
  else
    # imports が存在しないときは @Module に挿入
    sed -i "s/@Module({/@Module({\n  imports: [PrismaModule],/" "$file"
  fi

  echo "   ✔ PrismaModule を追加しました。"
done

echo "=== 完了 ==="
