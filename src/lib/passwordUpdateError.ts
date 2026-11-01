type AuthErrorLike = { code?: string; name?: string; status?: number; reasons?: string[] };

const LINK_EXPIRED =
  "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度、パスワード再設定をお試しください。";

function weakPasswordMessage(error: AuthErrorLike): string {
  if (error.reasons?.includes("pwned")) {
    return "このパスワードは過去に流出した可能性があるため使用できません。別のパスワードを入力してください。";
  }
  return "このパスワードは安全性が低いため使用できません。別のパスワードを入力してください。";
}

// 新規登録（signUp）に失敗したときの、利用者向けの文言。形式の検証を通ったあとに Supabase が拒否した場合に出る
export function signUpErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "weak_password":
      return weakPasswordMessage(error);
    case "user_already_exists":
    case "email_exists":
      return "このメールアドレスは既に使用されています";
    case "email_address_invalid":
      return "メールアドレスの形式が正しくありません";
  }
  if (error.status === 429) return "リクエストが多すぎます。しばらくしてから、もう一度お試しください。";
  return "登録に失敗しました。時間をおいて、もう一度お試しください。";
}

// 再設定ページでパスワードの保存（updateUser）に失敗したときの、利用者向けの文言。
// 以前は原因に関わらず「リンクの有効期限が切れている可能性があります」と表示しており、
// 「今のパスワードと同じ」（same_password）でもリンクの不具合と誤解されていた
export function passwordUpdateErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "same_password":
      return "現在のパスワードと同じです。別のパスワードを入力してください。現在のパスワードを思い出した場合は、ログイン画面からログインできます。";
    case "weak_password":
      return weakPasswordMessage(error);
    case "over_request_rate_limit":
      return "リクエストが多すぎます。しばらくしてから、もう一度お試しください。";
    case "session_not_found":
    case "session_expired":
      return LINK_EXPIRED;
  }
  if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) {
    return LINK_EXPIRED;
  }
  return "パスワードの更新に失敗しました。時間をおいて、もう一度お試しください。";
}
