import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  checkEventBadges: vi.fn().mockResolvedValue(undefined),
  checkRankUp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/badges", () => ({ checkEventBadges: mocks.checkEventBadges }));
vi.mock("@/lib/ranks", () => ({ checkRankUp: mocks.checkRankUp }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");

const DUMMY_REQUEST = {} as NextRequest;

// システム時刻: 2026-07-20T05:00:00Z（JST 14:00）
const NOW = "2026-07-20T05:00:00Z";

type BookingOverrides = Partial<{
  id: string;
  user_id: string;
  status: string;
  checked_in_at: string | null;
  events: { start_at: string; end_at: string | null };
}>;

function makeBooking(overrides: BookingOverrides = {}) {
  return {
    id: "booking-1",
    user_id: "user-1",
    status: "confirmed",
    checked_in_at: null,
    events: { start_at: "2026-07-20T04:00:00Z", end_at: "2026-07-20T06:00:00Z" },
    ...overrides,
  };
}

function setup({
  booking,
  updated = { id: "booking-1" },
  updateError = null,
  userId = "user-1",
}: {
  booking: unknown;
  updated?: unknown;
  updateError?: unknown;
  userId?: string;
}) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, email: "u@example.com" } } });

  const { from: userFrom } = createSupabaseMock();
  userFrom.mockReturnValueOnce(chainable({ data: booking })); // bookings select
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: userFrom });

  const updateSpy = vi.fn();
  const isSpy = vi.fn();
  const { from: serviceFrom } = createSupabaseMock();
  serviceFrom.mockReturnValue(
    chainable({ data: updated, error: updateError }, { update: updateSpy, is: isSpy })
  );
  mocks.createServiceClient.mockReturnValue({ from: serviceFrom });

  return { updateSpy, isSpy };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/bookings/[id]/checkin", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    expect(res.status).toBe(401);
  });

  it("予約が存在しない場合は404", async () => {
    setup({ booking: null });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    expect(res.status).toBe(404);
  });

  it("他人の予約の場合は403", async () => {
    setup({ booking: makeBooking({ user_id: "other" }) });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    expect(res.status).toBe(403);
  });

  it("キャンセル済みの予約は400", async () => {
    setup({ booking: makeBooking({ status: "cancelled" }) });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    expect(res.status).toBe(400);
  });

  it("イベント開始前は400", async () => {
    setup({
      booking: makeBooking({ events: { start_at: "2026-07-20T09:00:00Z", end_at: "2026-07-20T11:00:00Z" } }),
    });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("開始前");
  });

  it("イベント終了後は400", async () => {
    setup({
      booking: makeBooking({ events: { start_at: "2026-07-20T01:00:00Z", end_at: "2026-07-20T03:00:00Z" } }),
    });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("終了");
  });

  it("end_at 未設定のときは開始+2時間を終了とみなす", async () => {
    // 開始 2026-07-20T04:00Z、現在 05:00Z → +2h（06:00Z）以内なのでOK
    const { updateSpy } = setup({
      booking: makeBooking({ events: { start_at: "2026-07-20T04:00:00Z", end_at: null } }),
    });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ checked_in_at: expect.any(String) }));
  });

  it("既にチェックイン済みなら冪等に200を返す", async () => {
    setup({ booking: makeBooking({ checked_in_at: "2026-07-20T04:30:00Z" }) });
    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.already).toBe(true);
  });

  it("時間内の未チェックイン予約は checked_in_at を更新し、バッジ・ランクを再判定する", async () => {
    const { updateSpy, isSpy } = setup({ booking: makeBooking() });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ checked_in_at: expect.any(String) }));
    expect(isSpy).toHaveBeenCalledWith("checked_in_at", null);
    expect(mocks.checkEventBadges).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(mocks.checkRankUp).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});
