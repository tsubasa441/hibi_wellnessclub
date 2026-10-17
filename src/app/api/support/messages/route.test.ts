import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue(true),
  sendSupportInquiryToAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));
vi.mock("@/lib/email", () => ({ sendSupportInquiryToAdmin: mocks.sendSupportInquiryToAdmin }));

const { POST } = await import("./route");

function req(body: unknown) {
  return { json: async () => body } as NextRequest;
}

function setup({ insertError = null }: { insertError?: { message: string } | null } = {}) {
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
  });
  const insertSpy = vi.fn();
  const from = vi.fn((table: string) =>
    table === "support_messages"
      ? chainable(
          { data: insertError ? null : { id: "m1", sender: "user", body: "こんにちは", created_at: "2026-10-17T00:00:00Z" }, error: insertError },
          { insert: insertSpy }
        )
      : chainable({ data: { nickname: "つばさ" } })
  );
  mocks.createServiceClient.mockReturnValue({ from });
  return { insertSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

describe("POST /api/support/messages", () => {
  it("未認証は401", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const res = await POST(req({ body: "こんにちは" }));
    expect(res.status).toBe(401);
  });

  it("レート制限超過は429", async () => {
    setup();
    mocks.checkRateLimit.mockResolvedValue(false);
    const res = await POST(req({ body: "こんにちは" }));
    expect(res.status).toBe(429);
  });

  it("空のメッセージは400で保存しない", async () => {
    const { insertSpy } = setup();
    const res = await POST(req({ body: "   " }));
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(mocks.sendSupportInquiryToAdmin).not.toHaveBeenCalled();
  });

  it("本人の user_id・sender=user で保存し、運営へ本文つきで通知する", async () => {
    const { insertSpy } = setup();
    const res = await POST(req({ body: "  こんにちは  " }));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "user-1", sender: "user", body: "こんにちは" });
    expect(mocks.sendSupportInquiryToAdmin).toHaveBeenCalledWith({
      userId: "user-1",
      userName: "つばさ",
      body: "こんにちは",
    });
  });

  it("保存に失敗したら500で、通知は送らない", async () => {
    setup({ insertError: { message: "db error" } });
    const res = await POST(req({ body: "こんにちは" }));
    expect(res.status).toBe(500);
    expect(mocks.sendSupportInquiryToAdmin).not.toHaveBeenCalled();
  });
});
