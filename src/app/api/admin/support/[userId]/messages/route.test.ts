import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  isAdmin: vi.fn(),
  getUserById: vi.fn(),
  sendSupportReplyToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/admin", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/email", () => ({ sendSupportReplyToUser: mocks.sendSupportReplyToUser }));

const { POST } = await import("./route");

const params = { params: Promise.resolve({ userId: "user-1" }) };

function req(body: unknown) {
  return { json: async () => body } as NextRequest;
}

function setup({
  admin = true,
  profile = { id: "user-1", nickname: "つばさ" } as { id: string; nickname: string } | null,
  email = "user@example.com",
}: { admin?: boolean; profile?: { id: string; nickname: string } | null; email?: string } = {}) {
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
  });
  mocks.isAdmin.mockResolvedValue(admin);
  mocks.getUserById.mockResolvedValue({ data: { user: { email } } });
  const insertSpy = vi.fn();
  const from = vi.fn((table: string) =>
    table === "support_messages"
      ? chainable(
          { data: { id: "m1", sender: "admin", body: "ご連絡ありがとうございます", created_at: "2026-10-17T00:00:00Z" }, error: null },
          { insert: insertSpy }
        )
      : chainable({ data: profile })
  );
  mocks.createServiceClient.mockReturnValue({ from, auth: { admin: { getUserById: mocks.getUserById } } });
  return { insertSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/support/[userId]/messages", () => {
  it("未認証は401", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const res = await POST(req({ body: "返信" }), params);
    expect(res.status).toBe(401);
  });

  it("管理者以外は403で保存しない", async () => {
    const { insertSpy } = setup({ admin: false });
    const res = await POST(req({ body: "返信" }), params);
    expect(res.status).toBe(403);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("存在しないユーザーは404", async () => {
    const { insertSpy } = setup({ profile: null });
    const res = await POST(req({ body: "返信" }), params);
    expect(res.status).toBe(404);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("sender=admin で保存し、ユーザーへ返信の通知を送る", async () => {
    const { insertSpy } = setup();
    const res = await POST(req({ body: "ご連絡ありがとうございます" }), params);
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "user-1", sender: "admin", body: "ご連絡ありがとうございます" });
    expect(mocks.sendSupportReplyToUser).toHaveBeenCalledWith({ to: "user@example.com", userName: "つばさ" });
  });

  it("退会済みのユーザーにはメールを送らない", async () => {
    setup({ email: "deleted-user-1@deleted.invalid" });
    const res = await POST(req({ body: "返信" }), params);
    expect(res.status).toBe(200);
    expect(mocks.sendSupportReplyToUser).not.toHaveBeenCalled();
  });
});
