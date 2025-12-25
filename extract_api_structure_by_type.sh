#!/bin/bash
set -e

SRC_DIR="/var/www/exchange-api/src"
OUT_DIR="/var/www/exchange-api/_structure_export"

mkdir -p "$OUT_DIR"

CTRL_FILE="$OUT_DIR/controllers.txt"
SRV_FILE="$OUT_DIR/services.txt"
MOD_FILE="$OUT_DIR/modules.txt"
OTH_FILE="$OUT_DIR/others.txt"
DUP_FILE="$OUT_DIR/duplicates.txt"

# 初期化
: > "$CTRL_FILE"
: > "$SRV_FILE"
: > "$MOD_FILE"
: > "$OTH_FILE"
: > "$DUP_FILE"

declare -A CLASS_MAP

echo "Generated at: $(date)" >> "$CTRL_FILE"
echo "Generated at: $(date)" >> "$SRV_FILE"
echo "Generated at: $(date)" >> "$MOD_FILE"
echo "Generated at: $(date)" >> "$OTH_FILE"

# -----------------------------
# TS ファイル走査
# -----------------------------
find "$SRC_DIR" -type f -name "*.ts" | sort | while read -r file; do
  rel="${file#$SRC_DIR/}"
  category="$(dirname "$rel")"

  TYPE="OTHER"
  OUT="$OTH_FILE"

  if grep -q "@Controller" "$file"; then
    TYPE="CONTROLLER"
    OUT="$CTRL_FILE"
  elif grep -q "@Injectable" "$file"; then
    TYPE="SERVICE"
    OUT="$SRV_FILE"
  elif grep -q "@Module" "$file"; then
    TYPE="MODULE"
    OUT="$MOD_FILE"
  fi

  {
    echo "--------------------------------------------"
    echo "File     : $rel"
    echo "Category : $category"
    echo "Type     : $TYPE"
    echo ""

    # クラス名抽出
    grep -E "export class " "$file" \
      | sed 's/export class //g' \
      | sed 's/ .*//g' \
      | while read -r cls; do
          echo "Class    : $cls"
          CLASS_MAP["$cls"]+="$rel "
        done

    echo ""
    echo "Decorators:"
    grep -E "@Controller|@Injectable|@Module|@UseGuards" "$file" || true
    echo ""
  } >> "$OUT"

done

# -----------------------------
# 重複クラス検出
# -----------------------------
{
  echo "============================================"
  echo " Duplicate Class Definitions"
  echo "============================================"
  echo ""
} >> "$DUP_FILE"

for cls in "${!CLASS_MAP[@]}"; do
  count=$(echo "${CLASS_MAP[$cls]}" | wc -w)
  if [ "$count" -gt 1 ]; then
    echo "Class: $cls" >> "$DUP_FILE"
    echo "Defined in:" >> "$DUP_FILE"
    for loc in ${CLASS_MAP[$cls]}; do
      echo "  - $loc" >> "$DUP_FILE"
    done
    echo "" >> "$DUP_FILE"
  fi
done

echo "✅ API structure exported to: $OUT_DIR"
