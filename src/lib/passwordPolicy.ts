// サインアップ・パスワード再設定・設定画面でのパスワード変更で共通のバリデーション。
// 8〜15文字・半角英大文字/英小文字/数字/記号をすべて含む
export function validatePasswordFormat(password: string): string | null {
  if (password.length > 15) return "パスワードは15文字以内で入力してください";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  if (password.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
    return "パスワードを正しく設定してください";
  }
  return null;
}
