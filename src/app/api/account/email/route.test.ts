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
  upsert: vi.fn(),
  deleteEq: vi.fn(),
  sendEmailChangeRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({ upsert: mocks.upsert, delete: () => ({ eq: mocks.deleteEq }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createSupabaseClient }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));
vi.mock("@/lib/encrypt", () => ({ encrypt: (text: string) => `enc:${text}` }));
vi.mock("@/lib/email", () => ({ sendEmailChangeRequest: mocks.sendEmailChangeRequest }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");
const { hashEmailChangeToken } = await import("@/lib/emailChange");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "old@example.com" } } });
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
  mocks.sendEmailChangeRequest.mockResolvedValue(true);
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
  ])("%s は400で、申し込みを保存しない", async (_, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("現在のパスワードが違えば400で、申し込みを保存しない", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "wrong" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("現在のパスワードが正しくありません");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "old@example.com", password: "wrong" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("成功時は今のアドレスだけにメールを送り、Supabase には変更を申し込まない", async () => {
    const res = await POST(makeRequest({ email: "  New@Example.com ", currentPassword: "pw" }));
    expect(res.status).toBe(200);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });

    const mail = mocks.sendEmailChangeRequest.mock.calls[0][0];
    expect(mail.to).toBe("old@example.com");
    expect(mail.newEmail).toBe("new@example.com");
  });

  it("新しいアドレスは暗号化し、トークンはハッシュだけを保存する", async () => {
    await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));

    const saved = mocks.upsert.mock.calls[0][0];
    const { token } = mocks.sendEmailChangeRequest.mock.calls[0][0];
    expect(saved.user_id).toBe("user-1");
    expect(saved.new_email).toBe("enc:new@example.com");
    expect(saved.token_hash).toBe(hashEmailChangeToken(token));
    expect(saved.token_hash).not.toBe(token);
    expect(mocks.upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id" });
  });

  it("保存に失敗したら500で、メールは送らない", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "db error" } });
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(500);
    expect(mocks.sendEmailChangeRequest).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.captureMessage.mock.calls)).not.toContain("example.com");
  });

  it("メールを送れなければ500で、申し込みを消す", async () => {
    mocks.sendEmailChangeRequest.mockResolvedValue(false);
    const res = await POST(makeRequest({ email: "new@example.com", currentPassword: "pw" }));
    expect(res.status).toBe(500);
    expect(mocks.deleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
