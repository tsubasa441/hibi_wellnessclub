import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  paymentsCreate: vi.fn(),
  refundPayment: vi.fn(),
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

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("square", () => ({
  SquareClient: vi.fn().mockImplementation(function SquareClient() {
    return {
      payments: { create: mocks.paymentsCreate },
      refunds: { refundPayment: mocks.refundPayment },
    };
  }),
  SquareEnvironment: { Production: "production", Sandbox: "sandbox" },
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
    title: "Yoga Class",
    event_type: "yoga",
    description: "desc",
    start_at: "2026-08-01T00:00:00Z",
    location: "Fukuoka",
    ...overrides,
  };
}

function setupSupabase({
  existing = null,
  event,
  count = 0,
  insertError = null,
  userId = "user-1",
  email = "user@example.com",
}: {
  existing?: unknown;
  event: unknown;
  count?: number;
  insertError?: unknown;
  userId?: string;
  email?: string;
}) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, email } } });

  const { from } = createSupabaseMock();
  from.mockReturnValueOnce(chainable({ data: existing })); // 重複予約チェック
  from.mockReturnValueOnce(chainable({ data: event })); // イベント取得

  const insertSpy = vi.fn();
  from.mockReturnValueOnce(chainable({ error: insertError }, { insert: insertSpy })); // bookings insert
  from.mockReturnValueOnce(chainable({ data: { name: null } })); // profiles select

  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });

  // 残席カウントは service_role クライアント経由
  const serviceFrom = vi.fn().mockReturnValue(chainable({ count }));
  mocks.createServiceClient.mockReturnValue({ from: serviceFrom });

  return { from, insertSpy, serviceFrom };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/payments/square", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(401);
  });

  it("必須パラメータ不足の場合は400", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@b.com" } } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({ eventId: "event-1" })); // sourceId 欠如

    expect(res.status).toBe(400);
  });

  it("既に予約済みの場合は400", async () => {
    setupSupabase({ existing: { id: "existing-booking" }, event: makeEvent() });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("既に予約済み");
  });

  it("満席の場合は400", async () => {
    setupSupabase({ event: makeEvent({ capacity: 5 }), count: 5 });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("満席");
  });

  it("無料イベントはSquare決済を呼ばずに予約を確定する", async () => {
    setupSupabase({ event: makeEvent({ price: 0 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.paymentsCreate).not.toHaveBeenCalled();
    expect(mocks.checkRankUp).toHaveBeenCalled();
    expect(mocks.checkEventBadges).toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ price: 0, paymentMethod: "free" })
    );
  });

  it("ポイントで参加費全額を充当した場合はSquare決済を呼ばない", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    const { insertSpy } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 3000 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.paymentsCreate).not.toHaveBeenCalled();
    expect(mocks.spendPointsForBooking).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      3000,
      expect.any(String)
    );
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ points_used: 3000, amount_charged: 0 })
    );
  });

  it("ポイント残高が不足している場合は400を返し予約を作成しない", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(false);
    const { from } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 3000 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("ポイント残高が不足");
    expect(from).toHaveBeenCalledTimes(2); // insert には到達しない（残席カウントは service_role 側）
  });

  it("通常のSquare決済が成功した場合、amountToChargeで課金し予約を確定する", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-1", status: "COMPLETED" } });
    const { insertSpy } = setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.paymentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amountMoney: { amount: BigInt(3000), currency: "JPY" } })
    );
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: "sq-pay-1", amount_charged: 3000, points_used: 0 })
    );
  });

  it("決済が完了しなかった場合は400を返し、充当済みポイントを払い戻す", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-2", status: "FAILED" } });
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("決済に失敗");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });

  it("決済成功後に予約作成が失敗した場合、自動返金しポイントも払い戻す", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-3", status: "COMPLETED" } });
    mocks.refundPayment.mockResolvedValueOnce({});
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }), insertError: { message: "insert failed" } });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("決済を取り消しました");
    expect(mocks.refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "sq-pay-3", amountMoney: { amount: BigInt(2000), currency: "JPY" } })
    );
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });

  it("決済成功後の予約作成失敗＋返金も失敗した場合は500でサポート案内を返す", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-4", status: "COMPLETED" } });
    mocks.refundPayment.mockRejectedValueOnce(new Error("refund failed"));
    setupSupabase({ event: makeEvent({ price: 3000 }), insertError: { message: "insert failed" } });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("返金処理にも失敗しました");
  });

  it("決済APIが例外を投げた場合は500を返しポイントを払い戻す", async () => {
    mocks.paymentsCreate.mockRejectedValueOnce(new Error("network error"));
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }) });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("network error");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });
});
