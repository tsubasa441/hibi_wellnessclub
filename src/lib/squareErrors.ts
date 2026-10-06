// Square API のエラーをユーザー向けの文言に変換する。Square のエラー本文（detail 等）は画面に出さない
// （SquareError は `errors: { category, code, detail }[]` を持つ。テストのモックでも扱えるよう instanceof は使わない）
export function squareErrorCodes(err: unknown): string[] {
  if (!err || typeof err !== "object" || !("errors" in err)) return [];
  const errors = (err as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => (e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : ""))
    .filter(Boolean);
}

const DECLINED = "カードがご利用いただけませんでした。別のカードをお試しいただくか、カード会社にお問い合わせください。";

const MESSAGES: Record<string, string> = {
  CVV_FAILURE: "セキュリティコードが正しくありません。カード情報をご確認ください。",
  VERIFY_CVV_FAILURE: "セキュリティコードが正しくありません。カード情報をご確認ください。",
  INVALID_EXPIRATION: "有効期限が正しくないか、カードの有効期限が切れています。",
  EXPIRATION_FAILURE: "有効期限が正しくないか、カードの有効期限が切れています。",
  INSUFFICIENT_FUNDS: "ご利用可能額が不足しているため、カードがご利用いただけませんでした。",
  TRANSACTION_LIMIT: "ご利用限度額を超えているため、カードがご利用いただけませんでした。",
  CARD_NOT_SUPPORTED: "このカードはご利用いただけません。別のカードをお試しください。",
  INVALID_CARD: DECLINED,
  INVALID_CARD_DATA: DECLINED,
  GENERIC_DECLINE: DECLINED,
  CARD_DECLINED: DECLINED,
  CARD_DECLINED_VERIFICATION_REQUIRED: DECLINED,
  CARD_DECLINED_CALL_ISSUER: DECLINED,
  INVALID_ACCOUNT: DECLINED,
  ADDRESS_VERIFICATION_FAILURE: DECLINED,
  VOICE_FAILURE: DECLINED,
};

export function squareErrorMessage(err: unknown, fallback: string): string {
  for (const code of squareErrorCodes(err)) {
    if (MESSAGES[code]) return MESSAGES[code];
  }
  return fallback;
}
