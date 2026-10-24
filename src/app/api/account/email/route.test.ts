import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  createSupabaseClient: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  checkRateLimit: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createSupabaseClient }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "old@example.com" } } });
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.createSupabaseClient.mockReturnValue({
    auth: { signInWithPassword: mocks.signInWithPassword, updateUser: mocks.updateUser, signOut: mocks.signOut },
  });
});

describe("POST /api/account/email", () => {
  it("未認証は401", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(401);
  });

  it("レート制限超過は429で、パスワードの確認もしない", async () => {
    mocks.checkRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(429);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["未入力", { email: "", currentPassword: "pw" }],
    ["パスワード未入力", { email: "new@example.com", currentPassword: "" }],
    ["形式が不正", { email: "not-an-email", currentPassword: "pw" }],
    ["今と同じ（大文字小文字違い）", { email: "OLD@example.com", currentPassword: "pw" }],
  ])("%s は400で、Supabase に申し込まない", async (_, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("現在のパスワードが違えば400で、変更を申し込まない", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "wrong" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("現在のパスワードが正しくありません");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "old@example.com", password: "wrong" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("成功時は PKCE を使わないクライアントで申し込み、確認用のセッションを端末に影響させず破棄する", async () => {
    const res = await POST(makeRequest({ email: "  New@Example.com ", currentPassword: "pw" }));
    expect(res.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    const options = mocks.createSupabaseClient.mock.calls[0][2];
    expect(options.auth.persistSession).toBe(false);
    expect(options.auth.flowType).toBeUndefined();
  });

  it("既に使われているアドレスは400（他人のアカウントにはならない）", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "email_exists", status: 422, name: "AuthApiError" } });
    const res = await POST(makeRequest({ email: "taken@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("このメールアドレスは使用できません");
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("メール送信の上限は429", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429, name: "AuthApiError" } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(429);
  });

  it("想定外の失敗は500で、メールアドレスを含めずに記録する", async () => {
    mocks.updateUser.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, name: "AuthApiError" } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(500);
    const extra = mocks.captureMessage.mock.calls[0][1].extra;
    expect(JSON.stringify(extra)).not.toContain("example.com");
  });
});
