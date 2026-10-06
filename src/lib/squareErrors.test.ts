import { describe, expect, it } from "vitest";
import { squareErrorCodes, squareErrorMessage } from "./squareErrors";

function squareError(...codes: string[]) {
  return Object.assign(new Error(`Status code: 400 Body: ${JSON.stringify({ errors: codes.map((code) => ({ code })) })}`), {
    errors: codes.map((code) => ({ category: "PAYMENT_METHOD_ERROR", code, detail: "raw detail" })),
  });
}

describe("squareErrorCodes", () => {
  it("SquareError の errors からコードを取り出す", () => {
    expect(squareErrorCodes(squareError("GENERIC_DECLINE", "CVV_FAILURE"))).toEqual(["GENERIC_DECLINE", "CVV_FAILURE"]);
  });

  it("Square 以外のエラー・null は空配列", () => {
    expect(squareErrorCodes(new Error("network"))).toEqual([]);
    expect(squareErrorCodes(null)).toEqual([]);
    expect(squareErrorCodes({ errors: "x" })).toEqual([]);
  });
});

describe("squareErrorMessage", () => {
  it("既知のコードは日本語の案内に変換し、Square の本文を含めない", () => {
    const msg = squareErrorMessage(squareError("INVALID_CARD_DATA"), "fallback");
    expect(msg).toContain("カードがご利用いただけませんでした");
    expect(msg).not.toContain("Status code");
  });

  it("コードごとに案内を出し分ける", () => {
    expect(squareErrorMessage(squareError("CVV_FAILURE"), "f")).toContain("セキュリティコード");
    expect(squareErrorMessage(squareError("INVALID_EXPIRATION"), "f")).toContain("有効期限");
    expect(squareErrorMessage(squareError("INSUFFICIENT_FUNDS"), "f")).toContain("ご利用可能額");
  });

  it("未知のコード・Square 以外のエラーは fallback を返す", () => {
    expect(squareErrorMessage(squareError("SOMETHING_NEW"), "fallback")).toBe("fallback");
    expect(squareErrorMessage(new Error("network error"), "fallback")).toBe("fallback");
  });
});
