#!/bin/bash

BASE_DIR="/var/www/exchange-api/src/constants"

mkdir -p "$BASE_DIR"

# =========================
# KYC メッセージ定義
# =========================
cat << 'EOF' > "$BASE_DIR/kycMessages.ts"
export const KYC_MESSAGE_MAP = {
  1: {
    title: "本人確認申請ありがとうございます",
    body: "本人確認書類のご提出ありがとうございます。\n現在、確認作業を行っております。\n完了まで今しばらくお待ちください。"
  },

  2: {
    title: "本人確認書類の再提出のお願い",
    body: "ご提出いただいた本人確認書類に不備がありました。\n内容をご確認のうえ、正しい書類を再度ご提出ください。"
  },

  3: {
    title: "住所確認書類の再提出のお願い",
    body: "ご提出いただいた住所確認書類に不備がありました。\n内容をご確認のうえ、正しい書類を再度ご提出ください。"
  },

  // 4: 追加認証書類再提出（将来用）

  5: {
    title: "本人確認完了のお知らせ",
    body: "本人確認が完了しました。\nこれよりすべての機能をご利用いただけます。"
  }
} as const;
EOF

# =========================
# 入金・出金 メッセージ定義
# =========================
cat << 'EOF' > "$BASE_DIR/transferMessages.ts"
export const DEPOSIT_REQUEST_MESSAGE = {
  title: "入金申請ありがとうございます",
  body: "入金申請を受け付けました。\n着金確認後、取引口座へ反映されます。"
} as const;

export const DEPOSIT_COMPLETED_MESSAGE = {
  title: "入金完了のお知らせ",
  body: "入金の確認が取れました。\n取引口座へ残高を反映しました。"
} as const;

export const WITHDRAW_REQUEST_MESSAGE = {
  title: "出金申請を受け付けました",
  body: "出金申請を受け付けました。\n処理を開始しましたので、完了まで今しばらくお待ちください。"
} as const;
EOF

echo "✅ メッセージ定義ファイルを作成しました: $BASE_DIR"
