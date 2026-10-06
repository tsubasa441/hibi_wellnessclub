import { describe, expect, it, vi } from "vitest";

vi.mock("kuroshiro", () => ({ default: vi.fn() }));
vi.mock("kuroshiro-analyzer-kuromoji", () => ({ default: vi.fn() }));

const { formatRomaji } = await import("./toRomaji");

// signup/profile/route.ts の NAME_ROMAN_REGEX と同じ
const NAME_ROMAN_REGEX = /^[\p{L}\s　'-]{1,100}$/u;

describe("formatRomaji", () => {
  it("中黒を空白に置き換え、登録 API のローマ字チェックを通る形にする", () => {
    const result = formatRomaji("jon ･ sumisu");
    expect(result).toBe("Jon Sumisu");
    expect(NAME_ROMAN_REGEX.test(result)).toBe(true);
  });

  it("連続する空白をまとめ、各語の先頭を大文字にする（マクロンは残す）", () => {
    expect(formatRomaji("yamada   tarō")).toBe("Yamada Tarō");
  });

  it("変換されずに残った漢字は文字として残す", () => {
    expect(formatRomaji("yama 﨑   tarō")).toBe("Yama 﨑 Tarō");
  });
});
