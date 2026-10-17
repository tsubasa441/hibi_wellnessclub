export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

export type SupportMessage = {
  id: string;
  sender: "user" | "admin";
  body: string;
  created_at: string;
};

// お問い合わせ本文の検証（ユーザーの送信・運営の返信で共通）。前後の空白は除いて保存する
export function validateSupportBody(
  input: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "メッセージを入力してください" };
  const value = input.trim();
  if (value.length === 0) return { ok: false, error: "メッセージを入力してください" };
  if ([...value].length > SUPPORT_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `メッセージは${SUPPORT_MESSAGE_MAX_LENGTH}文字以内で入力してください` };
  }
  return { ok: true, value };
}
