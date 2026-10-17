import { describe, expect, it } from "vitest";
import { SUPPORT_MESSAGE_MAX_LENGTH, validateSupportBody } from "./support";

describe("validateSupportBody", () => {
  it("前後の空白を除いて受け付ける", () => {
    expect(validateSupportBody("  こんにちは\n  ")).toEqual({ ok: true, value: "こんにちは" });
  });

  it("空・空白だけ・文字列以外は弾く", () => {
    expect(validateSupportBody("").ok).toBe(false);
    expect(validateSupportBody("   \n ").ok).toBe(false);
    expect(validateSupportBody(undefined).ok).toBe(false);
    expect(validateSupportBody(123).ok).toBe(false);
  });

  it("上限ちょうどは通し、超えると弾く（絵文字等もコードポイント単位で数える）", () => {
    expect(validateSupportBody("あ".repeat(SUPPORT_MESSAGE_MAX_LENGTH)).ok).toBe(true);
    expect(validateSupportBody("あ".repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateSupportBody("𠮷".repeat(SUPPORT_MESSAGE_MAX_LENGTH)).ok).toBe(true);
  });
});
