import { describe, expect, it } from "vitest";
import { passwordUpdateErrorMessage } from "./passwordUpdateError";

describe("passwordUpdateErrorMessage", () => {
  it("今のパスワードと同じ場合（same_password）は、リンクの期限切れとは言わず、別のパスワードを促す", () => {
    const msg = passwordUpdateErrorMessage({ code: "same_password", status: 422 });
    expect(msg).toContain("現在のパスワードと同じ");
    expect(msg).not.toContain("有効期限");
  });

  it("弱いパスワード（weak_password）は、パスワードの問題として案内する", () => {
    const msg = passwordUpdateErrorMessage({ code: "weak_password" });
    expect(msg).toContain("安全性が低い");
    expect(msg).not.toContain("有効期限");
  });

  it("レート制限は、時間をおくよう案内する", () => {
    expect(passwordUpdateErrorMessage({ code: "over_request_rate_limit" })).toContain("しばらくしてから");
  });

  it.each([
    ["session_not_found", { code: "session_not_found" }],
    ["session_expired", { code: "session_expired" }],
    ["セッションなし（AuthSessionMissingError）", { name: "AuthSessionMissingError" }],
    ["401", { status: 401 }],
    ["403", { status: 403 }],
  ])("セッションが無い・切れている場合（%s）は、リンクの有効期限切れとして案内する", (_label, error) => {
    expect(passwordUpdateErrorMessage(error)).toContain("リンクの有効期限が切れている");
  });

  it("想定外のエラーは、リンクの期限切れとは断定せず、時間をおいて再試行を促す", () => {
    const msg = passwordUpdateErrorMessage({ code: "unexpected_failure", status: 500 });
    expect(msg).toContain("時間をおいて");
    expect(msg).not.toContain("有効期限");
  });

  it("エラーの情報が空でも例外を投げず、汎用の文言を返す", () => {
    expect(passwordUpdateErrorMessage({})).toContain("パスワードの更新に失敗しました");
  });
});
