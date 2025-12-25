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
