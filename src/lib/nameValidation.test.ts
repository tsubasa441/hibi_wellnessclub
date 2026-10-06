import { describe, expect, it } from "vitest";
import { normalizePersonName, validateName, validateNickname } from "./nameValidation";

describe("normalizePersonName", () => {
  it("全角英数字を半角に、半角カナを全角に、全角スペースを半角に揃え、空白をまとめる", () => {
    expect(normalizePersonName("  Ｔａｒｏ　　Ｙａｍａｄａ ")).toBe("Taro Yamada");
    expect(normalizePersonName("ﾀﾛｳ")).toBe("タロウ");
    expect(normalizePersonName("ゆう１２３")).toBe("ゆう123");
  });
});

describe("validateName", () => {
  it.each([
    "山田 太郎",
    "佐々木 花子",
    "野々村 奈々",
    "山﨑 太郎",
    "髙橋 一郎",
    "𠮷田 太郎",
    "〆木 太郎",
    "ジョン・スミス",
    "Taro Yamada",
    "やまだ たろう",
    "ヤマダ タロウ",
  ])("%s は登録できる", (name) => {
    expect(validateName(name)).toEqual({ ok: true, value: name });
  });

  it("全角英字は半角に揃えて受け付ける", () => {
    expect(validateName("Ｔａｒｏ　Ｙａｍａｄａ")).toEqual({ ok: true, value: "Taro Yamada" });
  });

  it.each(["José García", "O'Brien", "Smith-Jones", "山田太郎1", "たろう_", "ゆう☆", "太郎😀"])(
    "%s は登録できない（記号・数字・アクセント付きの文字・絵文字）",
    (name) => {
      const result = validateName(name);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("漢字・ひらがな・カタカナ・英字");
    }
  );

  it.each(["ー", "・・・", "ー・ー"])("長音符・中黒だけの %s は登録できない", (name) => {
    expect(validateName(name).ok).toBe(false);
  });

  it("空・空白のみは未入力として扱う", () => {
    expect(validateName("   ")).toEqual({ ok: false, error: "お名前を入力してください" });
    expect(validateName(undefined)).toEqual({ ok: false, error: "お名前を入力してください" });
  });

  it("30文字まで登録でき、31文字は不可（サロゲートペアは1文字として数える）", () => {
    expect(validateName("あ".repeat(30)).ok).toBe(true);
    expect(validateName("𠮷".repeat(30)).ok).toBe(true);
    expect(validateName("あ".repeat(31))).toEqual({ ok: false, error: "お名前は30文字以内で入力してください" });
  });
});

describe("validateNickname", () => {
  it.each(["タロウ", "たろう", "Taro", "taro123", "ゆう 23", "ナナ々", "ターロー"])("%s は登録できる", (nickname) => {
    expect(validateNickname(nickname)).toEqual({ ok: true, value: nickname });
  });

  it("全角英数字・半角カナは揃えて受け付ける", () => {
    expect(validateNickname("ＭＡＩ１２３")).toEqual({ ok: true, value: "MAI123" });
    expect(validateNickname("ﾀﾛｳ")).toEqual({ ok: true, value: "タロウ" });
  });

  it.each(["mai.", "たろう_23", "ゆう☆", "Taro!", "ゆう😀", "@@@"])("記号・絵文字を含む %s は登録できない", (nickname) => {
    const result = validateNickname(nickname);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("記号・絵文字は使えません");
  });

  it("数字だけのニックネームは登録できる、長音符だけは不可", () => {
    expect(validateNickname("123").ok).toBe(true);
    expect(validateNickname("ー").ok).toBe(false);
  });

  it("20文字まで登録でき、21文字は不可", () => {
    expect(validateNickname("a".repeat(20)).ok).toBe(true);
    expect(validateNickname("a".repeat(21))).toEqual({ ok: false, error: "ニックネームは20文字以内で入力してください" });
  });
});
