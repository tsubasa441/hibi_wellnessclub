// 氏名・ニックネームの正規化と入力チェック（新規登録フォーム・登録 API・ニックネーム変更 API で共通）

// NFKC で全角英数字→半角・半角カナ→全角・全角スペース→半角に揃え、連続する空白を1つにまとめる
export function normalizePersonName(input: string): string {
  return input.normalize("NFKC").trim().replace(/\s+/g, " ");
}

// 漢字（々・異体字・拡張漢字を含む）・ひらがな・カタカナ・英字。〆 は Unicode 上 Han ではないため個別に許可
const LETTER = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}〆A-Za-z";
// 長音符・中黒（ジョン・スミス等）は文字の間でのみ使える。これらだけの名前は不可
const JOINERS = "ー・";

const NAME_CHARS = new RegExp(`^[${LETTER}${JOINERS} ]+$`, "u");
const NICKNAME_CHARS = new RegExp(`^[${LETTER}0-9${JOINERS} ]+$`, "u");
const HAS_LETTER = new RegExp(`[${LETTER}]`, "u");
const HAS_LETTER_OR_DIGIT = new RegExp(`[${LETTER}0-9]`, "u");

export const NAME_MAX_LENGTH = 30;
export const NICKNAME_MAX_LENGTH = 20;

export type NameValidationResult = { ok: true; value: string } | { ok: false; error: string };

// 文字数はコードポイント単位で数える（𠮷 などのサロゲートペアも1文字）
function charLength(s: string): number {
  return [...s].length;
}

export function validateName(input: string | undefined | null): NameValidationResult {
  const value = normalizePersonName(input ?? "");
  if (!value) return { ok: false, error: "お名前を入力してください" };
  if (charLength(value) > NAME_MAX_LENGTH) {
    return { ok: false, error: `お名前は${NAME_MAX_LENGTH}文字以内で入力してください` };
  }
  if (!NAME_CHARS.test(value) || !HAS_LETTER.test(value)) {
    return { ok: false, error: "お名前は漢字・ひらがな・カタカナ・英字で入力してください" };
  }
  return { ok: true, value };
}

export function validateNickname(input: string | undefined | null): NameValidationResult {
  const value = normalizePersonName(input ?? "");
  if (!value) return { ok: false, error: "ニックネームを入力してください" };
  if (charLength(value) > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください` };
  }
  if (!NICKNAME_CHARS.test(value) || !HAS_LETTER_OR_DIGIT.test(value)) {
    return { ok: false, error: "ニックネームは漢字・ひらがな・カタカナ・英数字で入力してください（記号・絵文字は使えません）" };
  }
  return { ok: true, value };
}
