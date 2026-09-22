import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  createServiceClient: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue(true),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => "127.0.0.1",
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.createServiceClient.mockReturnValue({
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("レート制限超過は429", async () => {
    mocks.checkRateLimit.mockResolvedValue(false);

    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(429);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("メールアドレスが未指定は400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("メールアドレスの形式が不正なら400", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("成功時、service_roleクライアント（PKCEを使わないflowType）経由でresetPasswordForEmailを呼び200を返す", async () => {
    const res = await POST(makeRequest({ email: "user@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mocks.createServiceClient).toHaveBeenCalled();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/reset-password") })
    );
  });

  it("resetPasswordForEmailがエラーを返したら500", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "smtp error" } });

    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(500);
  });

  it("送信に失敗したとき、理由を Sentry に記録する（メールアドレスは記録しない）", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", status: 429, name: "AuthApiError", message: "email rate limit exceeded" },
    });

    await POST(makeRequest({ email: "friend-secret@example.com" }));

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Password reset email failed to send",
      expect.objectContaining({ extra: expect.objectContaining({ authErrorCode: "over_email_send_rate_limit", authErrorStatus: 429 }) })
    );
    expect(JSON.stringify(mocks.captureMessage.mock.calls)).not.toContain("friend-secret@example.com");
  });

  it("送信に成功したときは Sentry に記録しない", async () => {
    await POST(makeRequest({ email: "user@example.com" }));
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });
});
