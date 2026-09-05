import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));

const { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } = await import("./rateLimit");

function makeRequest(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("checkRateLimit", () => {
  it("RPCがtrueを返せば許可する", async () => {
    const { supabase, rpc } = createSupabaseMock();
    rpc.mockResolvedValue({ data: true, error: null });
    mocks.createServiceClient.mockReturnValue(supabase);

    const allowed = await checkRateLimit("test-key", 5, 60);

    expect(allowed).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "test-key",
      p_limit: 5,
      p_window_seconds: 60,
    });
  });

  it("RPCがfalseを返せば拒否する（上限超過）", async () => {
    const { supabase, rpc } = createSupabaseMock();
    rpc.mockResolvedValue({ data: false, error: null });
    mocks.createServiceClient.mockReturnValue(supabase);

    const allowed = await checkRateLimit("test-key", 5, 60);

    expect(allowed).toBe(false);
  });

  it("RPC呼び出し自体がエラーの場合はfail open（許可）する", async () => {
    const { supabase, rpc } = createSupabaseMock();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    mocks.createServiceClient.mockReturnValue(supabase);

    const allowed = await checkRateLimit("test-key", 5, 60);

    expect(allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("x-forwarded-forの先頭を返す", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("x-forwarded-forが無ければx-real-ipを返す", () => {
    const req = makeRequest({ "x-real-ip": "203.0.113.2" });
    expect(getClientIp(req)).toBe("203.0.113.2");
  });

  it("どちらも無ければunknownを返す", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("RATE_LIMIT_MESSAGE", () => {
  it("ユーザー向けの日本語メッセージが定義されている", () => {
    expect(RATE_LIMIT_MESSAGE.length).toBeGreaterThan(0);
  });
});
