import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function setup({ updateError = null }: { updateError?: { message: string } | null } = {}) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const updateSpy = vi.fn();
  const fromSpy = vi.fn().mockReturnValue(chainable({ data: null, error: updateError }, { update: updateSpy }));
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: fromSpy,
  });
  return { fromSpy, updateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/profile/nickname", () => {
  it("未認証は401", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const res = await POST(makeRequest({ nickname: "テスト" }));
    expect(res.status).toBe(401);
  });

  it("レート制限超過は429", async () => {
    setup();
    mocks.checkRateLimit.mockResolvedValue(false);

    const res = await POST(makeRequest({ nickname: "テスト" }));
    expect(res.status).toBe(429);
  });

  it("空文字は400", async () => {
    setup();
    const res = await POST(makeRequest({ nickname: "" }));
    expect(res.status).toBe(400);
  });

  it("21文字以上は400", async () => {
    setup();
    const res = await POST(makeRequest({ nickname: "あ".repeat(21) }));
    expect(res.status).toBe(400);
  });

  it("絵文字・記号のみは400", async () => {
    setup();
    const res = await POST(makeRequest({ nickname: "🎉🎉🎉" }));
    expect(res.status).toBe(400);
  });

  it("20文字ちょうどは成功しtrimして保存する", async () => {
    const { updateSpy } = setup();
    const twentyChars = "あ".repeat(20);
    const res = await POST(makeRequest({ nickname: `  ${twentyChars}  ` }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nickname).toBe(twentyChars);
    expect(updateSpy).toHaveBeenCalledWith({ nickname: twentyChars });
  });

  it("DB更新が失敗したら500", async () => {
    setup({ updateError: { message: "db error" } });
    const res = await POST(makeRequest({ nickname: "テスト" }));
    expect(res.status).toBe(500);
  });
});
