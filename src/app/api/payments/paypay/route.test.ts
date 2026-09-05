import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  qrCodeCreate: vi.fn(),
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  checkRankUp: vi.fn().mockResolvedValue(undefined),
  checkEventBadges: vi.fn().mockResolvedValue(undefined),
  spendPointsForBooking: vi.fn(),
  refundUsedPoints: vi.fn().mockResolvedValue(undefined),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@paypayopa/paypayopa-sdk-node", () => ({
  default: { Configure: vi.fn(), QRCodeCreate: mocks.qrCodeCreate },
}));

vi.mock("@/lib/email", () => ({
  sendBookingConfirmation: mocks.sendBookingConfirmation,
}));

vi.mock("@/lib/encrypt", () => ({
  decrypt: (v: string) => v,
}));

vi.mock("@/lib/ranks", () => ({
  checkRankUp: mocks.checkRankUp,
}));

vi.mock("@/lib/badges", () => ({
  checkEventBadges: mocks.checkEventBadges,
}));

vi.mock("@/lib/points", () => ({
  spendPointsForBooking: mocks.spendPointsForBooking,
  refundUsedPoints: mocks.refundUsedPoints,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function makeEvent(overrides: Partial<{
  capacity: number;
  price: number;
  title: string;
  event_type: string;
  description: string;
  start_at: string;
  location: string;
}> = {}) {
  return {
    capacity: 10,
    price: 3000,
    title: "Boxing Class",
    event_type: "boxing",
    description: "desc",
    start_at: "2026-08-01T00:00:00Z",
    location: "Tokyo",
    ...overrides,
  };
}

function setupSupabase({
  existing = null,
  event,
  count = 0,
  bookingInsertResult = { data: { id: "booking-1" }, error: null },
  userId = "user-1",
  email = "user@example.com",
}: {
  existing?: unknown;
  event: unknown | null;
  count?: number;
  bookingInsertResult?: { data: unknown; error: unknown };
  userId?: string;
  email?: string;
}) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, email } } });

  const { from } = createSupabaseMock();
  from.mockReturnValueOnce(chainable({ data: existing })); // 重複予約チェック
  from.mockReturnValueOnce(chainable({ data: event })); // イベント取得
  const insertSpy = vi.fn();
  from.mockReturnValueOnce(chainable(bookingInsertResult, { insert: insertSpy })); // bookings insert

  const updateSpy = vi.fn();
  from.mockReturnValueOnce(chainable({}, { update: updateSpy })); // payment_status/payment_id 更新 or delete
  from.mockReturnValueOnce(chainable({ data: { name: null } })); // profiles select

  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });

  // 残席カウントは service_role クライアント経由
  const serviceFrom = vi.fn().mockReturnValue(chainable({ count }));
  mocks.createServiceClient.mockReturnValue({ from: serviceFrom });

  return { from, insertSpy, updateSpy, serviceFrom };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/payments/paypay", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("eventId不足の場合は400", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it("既に予約済みの場合は400", async () => {
    setupSupabase({ existing: { id: "existing-booking" }, event: makeEvent() });

    const res = await POST(makeRequest({ eventId: "event-1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("既に予約済み");
  });

  it("イベントが見つからない場合は404", async () => {
    setupSupabase({ event: null });

    const res = await POST(makeRequest({ eventId: "event-1" }));

    expect(res.status).toBe(404);
  });

  it("満席の場合は400", async () => {
    setupSupabase({ event: makeEvent({ capacity: 5 }), count: 5 });

    const res = await POST(makeRequest({ eventId: "event-1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("満席");
  });

  it("ポイント残高が不足している場合は400を返し予約を作成しない", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(false);
    const { insertSpy } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", pointsToUse: 3000 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("ポイント残高が不足");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("予約作成に失敗した場合は充当ポイントを払い戻し500を返す", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({
      event: makeEvent({ price: 3000 }),
      bookingInsertResult: { data: null, error: { message: "insert failed" } },
    });

    const res = await POST(makeRequest({ eventId: "event-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("予約の作成に失敗しました");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });

  it("ポイントで参加費全額を充当した場合はPayPay決済を呼ばず即座に確定する", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    const { updateSpy } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", pointsToUse: 3000 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.qrCodeCreate).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith({ payment_status: "paid" });
    // ランク・バッジは予約時ではなくチェックイン時に判定する
    expect(mocks.checkRankUp).not.toHaveBeenCalled();
    expect(mocks.checkEventBadges).not.toHaveBeenCalled();
  });

  it("通常のPayPay決済が成功した場合、amountToChargeでQRコードを作成する", async () => {
    mocks.qrCodeCreate.mockResolvedValueOnce({
      BODY: { resultInfo: { code: "SUCCESS" }, data: { url: "https://paypay.example/pay/1" } },
    });
    const { updateSpy } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirectUrl).toBe("https://paypay.example/pay/1");
    expect(mocks.qrCodeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: { amount: 3000, currency: "JPY" } })
    );
    expect(updateSpy).toHaveBeenCalledWith({ payment_id: "booking-1" });
  });

  it("QRコード作成が例外を投げた場合は予約を削除しポイントを払い戻す", async () => {
    mocks.qrCodeCreate.mockRejectedValueOnce(new Error("paypay down"));
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("PayPay決済の開始に失敗しました");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });

  it("PayPayの応答が失敗コードの場合は予約を削除しポイントを払い戻す", async () => {
    mocks.qrCodeCreate.mockResolvedValueOnce({ BODY: { resultInfo: { code: "FAILURE" } } });
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("PayPay決済URLの取得に失敗しました");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });
});
