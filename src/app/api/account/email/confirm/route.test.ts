import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  captureMessage: vi.fn(),
  deleteEq: vi.fn(),
  maybeSingle: vi.fn(),
  getUserById: vi.fn(),
  generateLink: vi.fn(),
  sendEmailChangeConfirmation: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      delete: () => ({
        eq: (...args: unknown[]) => {
          mocks.deleteEq(...args);
          return { select: () => ({ maybeSingle: mocks.maybeSingle }) };
        },
      }),
    }),
    auth: { admin: { getUserById: mocks.getUserById, generateLink: mocks.generateLink } },
  }),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));
vi.mock("@/lib/encrypt", () => ({ decrypt: (text: string) => text.replace("enc:", "") }));
vi.mock("@/lib/email", () => ({ sendEmailChangeConfirmation: mocks.sendEmailChangeConfirmation }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: () => "1.2.3.4" }));

const { POST } = await import("./route");
const { hashEmailChangeToken } = await import("@/lib/emailChange");

function makeRequest(token?: string) {
  const form = new FormData();
  if (token !== undefined) form.set("token", token);
  return { url: "https://example.test/api/account/email/confirm", formData: async () => form } as unknown as NextRequest;
}

const statusOf = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("status");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.maybeSingle.mockResolvedValue({
    data: { user_id: "user-1", new_email: "enc:new@example.com", expires_at: new Date(Date.now() + 60_000).toISOString() },
  });
  mocks.getUserById.mockResolvedValue({ data: { user: { email: "old@example.com" } } });
  mocks.generateLink.mockResolvedValue({ data: { properties: { hashed_token: "hash-1" } }, error: null });
  mocks.sendEmailChangeConfirmation.mockResolvedValue(true);
});

describe("POST /api/account/email/confirm", () => {
  it("有効なトークンで、新しいアドレスへ確認メールを送る", async () => {
    const res = await POST(makeRequest("token-1"));
    expect(res.status).toBe(303);
    expect(statusOf(res)).toBe("sent");
    expect(mocks.deleteEq).toHaveBeenCalledWith("token_hash", hashEmailChangeToken("token-1"));
    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "email_change_current",
      email: "old@example.com",
      newEmail: "new@example.com",
    });
    expect(mocks.sendEmailChangeConfirmation).toHaveBeenCalledWith({ to: "new@example.com", tokenHash: "hash-1" });
  });

  it("トークンが無い・使用済みなら invalid で、リンクを作らない", async () => {
    expect(statusOf(await POST(makeRequest()))).toBe("invalid");
    mocks.maybeSingle.mockResolvedValue({ data: null });
    expect(statusOf(await POST(makeRequest("used")))).toBe("invalid");
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("期限切れなら invalid で、リンクを作らない", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { user_id: "user-1", new_email: "enc:new@example.com", expires_at: new Date(Date.now() - 1000).toISOString() },
    });
    expect(statusOf(await POST(makeRequest("old")))).toBe("invalid");
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("レート制限を超えたら invalid で、トークンを消費しない", async () => {
    mocks.checkRateLimit.mockResolvedValue(false);
    expect(statusOf(await POST(makeRequest("token-1")))).toBe("invalid");
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it("既に使われているアドレスは taken で、メールを送らない", async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { code: "email_exists", status: 422 } });
    expect(statusOf(await POST(makeRequest("token-1")))).toBe("taken");
    expect(mocks.sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it("想定外の失敗は、メールアドレスを含めずに記録する", async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { code: "unexpected_failure", status: 500, name: "AuthApiError" } });
    expect(statusOf(await POST(makeRequest("token-1")))).toBe("invalid");
    expect(JSON.stringify(mocks.captureMessage.mock.calls)).not.toContain("example.com");
  });

  it("メールを送れなければ invalid", async () => {
    mocks.sendEmailChangeConfirmation.mockResolvedValue(false);
    expect(statusOf(await POST(makeRequest("token-1")))).toBe("invalid");
  });
});
