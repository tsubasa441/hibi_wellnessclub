import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "./encrypt";

const KEY_A = "0123456789abcdef".repeat(4);
const KEY_B = "fedcba9876543210".repeat(4);

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", KEY_A);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encrypt / decrypt", () => {
  it.each([
    ["日本語", "山田 太郎"],
    ["ローマ字（マクロン入り）", "Gō Yūta"],
    ["絵文字", "😀🏃"],
    ["日付", "2000-01-15"],
    ["空文字", ""],
    ["長い文字列", "あ".repeat(1000)],
  ])("往復変換で元に戻る: %s", (_label, plain) => {
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("iv:authTag:暗号文 の16進形式になり、平文を含まない", () => {
    const encrypted = encrypt("山田 太郎");
    const [iv, tag, body] = encrypted.split(":");
    expect(iv).toMatch(/^[0-9a-f]{24}$/);
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
    expect(body).toMatch(/^[0-9a-f]+$/);
    expect(encrypted).not.toContain("山田");
  });

  it("同じ平文でも毎回異なる暗号文になる（IV がランダム）", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("暗号文が改ざんされていたら復号せず、平文を返さない（GCM 認証）", () => {
    const [iv, tag, body] = encrypt("secret").split(":");
    const flipped = (body[0] === "0" ? "1" : "0") + body.slice(1);
    const tampered = `${iv}:${tag}:${flipped}`;
    expect(decrypt(tampered)).toBe(tampered);
    expect(decrypt(tampered)).not.toBe("secret");
  });

  it("別の鍵では復号できず、平文を返さない", () => {
    const encrypted = encrypt("secret");
    vi.stubEnv("ENCRYPTION_KEY", KEY_B);
    expect(decrypt(encrypted)).toBe(encrypted);
  });

  it("暗号形式でない文字列（移行前の平文など）はそのまま返す", () => {
    expect(decrypt("plain text")).toBe("plain text");
    expect(decrypt("退会済みユーザー")).toBe("退会済みユーザー");
  });

  it("ENCRYPTION_KEY が未設定なら encrypt は例外を投げる", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encrypt("x")).toThrow("ENCRYPTION_KEY");
  });

  it("ENCRYPTION_KEY が64文字でなければ encrypt は例外を投げる", () => {
    vi.stubEnv("ENCRYPTION_KEY", "abc");
    expect(() => encrypt("x")).toThrow("ENCRYPTION_KEY");
  });
});
