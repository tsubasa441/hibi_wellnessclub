type AuthErrorLike = { code?: string; name?: string; status?: number };

const LINK_EXPIRED =
  "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度、パスワード再設定をお試しください。";

// 再設定ページでパスワードの保存（updateUser）に失敗したときの、利用者向けの文言。
// 以前は原因に関わらず「リンクの有効期限が切れている可能性があります」と表示しており、
// 「今のパスワードと同じ」（same_password）でもリンクの不具合と誤解されていた
export function passwordUpdateErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "same_password":
      return "現在のパスワードと同じです。別のパスワードを入力してください。現在のパスワードを思い出した場合は、ログイン画面からログインできます。";
    case "weak_password":
      return "このパスワードは安全性が低いため使用できません。別のパスワードを入力してください。";
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
