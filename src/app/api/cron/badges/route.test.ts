import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  checkEventBadges: vi.fn(),
  awardBadgeCountPoints: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/badges", () => ({
  checkEventBadges: mocks.checkEventBadges,
}));

vi.mock("@/lib/points", () => ({
  awardBadgeCountPoints: mocks.awardBadgeCountPoints,
}));

const { GET } = await import("./route");

function makeRequest(auth?: string): NextRequest {
  return {
    headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.useFakeTimers();
  mocks.awardBadgeCountPoints.mockResolvedValue(undefined);
  mocks.checkEventBadges.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/badges 認証", () => {
  it("CRON_SECRET が一致しない場合は401", async () => {
    vi.setSystemTime(new Date("2026-09-10T00:00:00Z"));
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/badges 月初ゲート（8-2）", () => {
  it("JSTで月の1日のとき前月のバッジ数ボーナスを付与する", async () => {
    // 2026-09-01 09:00 JST
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const from = vi.fn()
      .mockReturnValueOnce(chainable({ data: [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u2" }] }))
      .mockReturnValueOnce(chainable({ data: [], error: null }));
    mocks.createServiceClient.mockReturnValue({ from });

    const res = await GET(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(mocks.awardBadgeCountPoints).toHaveBeenCalledTimes(2);
    expect(mocks.awardBadgeCountPoints).toHaveBeenCalledWith(expect.anything(), "u1", "2026-08");
    expect(mocks.awardBadgeCountPoints).toHaveBeenCalledWith(expect.anything(), "u2", "2026-08");
  });

  it("UTCでは前月でもJSTで1日ならその月の前月を対象にする（年またぎ）", async () => {
    // 2025-12-31 15:00 UTC = 2026-01-01 00:00 JST
    vi.setSystemTime(new Date("2025-12-31T15:00:00Z"));
    const from = vi.fn()
      .mockReturnValueOnce(chainable({ data: [{ user_id: "u1" }] }))
      .mockReturnValueOnce(chainable({ data: [], error: null }));
    mocks.createServiceClient.mockReturnValue({ from });

    await GET(makeRequest("Bearer test-secret"));

    expect(mocks.awardBadgeCountPoints).toHaveBeenCalledWith(expect.anything(), "u1", "2025-12");
  });

  it("JSTで月の2日以降のときはバッジ数ボーナスを付与しない", async () => {
    vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
    const from = vi.fn().mockReturnValueOnce(chainable({ data: [], error: null }));
    mocks.createServiceClient.mockReturnValue({ from });

    const res = await GET(makeRequest("Bearer test-secret"));

    expect(res.status).toBe(200);
    expect(mocks.awardBadgeCountPoints).not.toHaveBeenCalled();
  });

  it("UTCで1日でもJSTではまだ前月最終日なら付与しない", async () => {
    // 2026-09-01 00:00 UTC = 2026-09-01 09:00 JST … これは1日。
    // 逆に月末判定の境界: 2026-08-31 14:00 UTC = 2026-08-31 23:00 JST → 31日
    vi.setSystemTime(new Date("2026-08-31T14:00:00Z"));
    const from = vi.fn().mockReturnValueOnce(chainable({ data: [], error: null }));
    mocks.createServiceClient.mockReturnValue({ from });

    await GET(makeRequest("Bearer test-secret"));

    expect(mocks.awardBadgeCountPoints).not.toHaveBeenCalled();
  });
});
