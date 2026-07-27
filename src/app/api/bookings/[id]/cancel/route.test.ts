import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refundPayment: vi.fn().mockResolvedValue({}),
  paypayRefund: vi.fn().mockResolvedValue({}),
  sendCancellationNotification: vi.fn().mockResolvedValue(undefined),
  revokeEventPoints: vi.fn().mockResolvedValue(undefined),
  refundUsedPoints: vi.fn().mockResolvedValue(undefined),
  createServiceClient: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createServiceClient,
}));

vi.mock("square", () => ({
  SquareClient: vi.fn().mockImplementation(function SquareClient() {
    return { refunds: { refundPayment: mocks.refundPayment } };
  }),
  SquareEnvironment: { Production: "production", Sandbox: "sandbox" },
}));

vi.mock("@paypayopa/paypayopa-sdk-node", () => ({
  default: { Configure: vi.fn(), PaymentRefund: mocks.paypayRefund },
}));

vi.mock("@/lib/email", () => ({
  sendCancellationNotification: mocks.sendCancellationNotification,
}));

vi.mock("@/lib/encrypt", () => ({
  decrypt: (v: string) => v,
}));

vi.mock("@/lib/points", () => ({
  revokeEventPoints: mocks.revokeEventPoints,
  refundUsedPoints: mocks.refundUsedPoints,
}));

const { POST } = await import("./route");

const DUMMY_REQUEST = {} as NextRequest;

type BookingOverrides = Partial<{
  id: string;
  user_id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_id: string | null;
  points_used: number;
  amount_charged: number;
  events: { start_at: string; price: number; title: string };
}>;

function makeBooking(overrides: BookingOverrides = {}) {
  return {
    id: "booking-1",
    user_id: "user-1",
    status: "confirmed",
    payment_method: "square",
    payment_status: "paid",
    payment_id: "sq-payment-1",
    points_used: 0,
    amount_charged: 3000,
    events: { start_at: "2026-07-25T00:00:00Z", price: 3000, title: "Yoga Class" },
    ...overrides,
  };
}

function setupSupabase({
  booking,
  claimed = { id: "booking-1" },
  claimError = null,
  userId = "user-1",
  email = "user@example.com",
}: {
  booking: unknown;
  claimed?: unknown;
  claimError?: unknown;
  userId?: string;
  email?: string;
}) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, email } } });

  const { from: userFrom } = createSupabaseMock();
  userFrom.mockReturnValueOnce(chainable({ data: booking })); // bookings select
  userFrom.mockReturnValueOnce(chainable({ data: { name: null } })); // profiles select
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: userFrom });

  const claimUpdateSpy = vi.fn();
  const paymentStatusUpdateSpy = vi.fn();
  const { from: serviceFrom } = createSupabaseMock();
  serviceFrom.mockReturnValueOnce(chainable({ data: claimed, error: claimError }, { update: claimUpdateSpy }));
  serviceFrom.mockReturnValueOnce(chainable({}, { update: paymentStatusUpdateSpy }));
  mocks.createServiceClient.mockReturnValue({ from: serviceFrom });

  return { userFrom, serviceFrom, claimUpdateSpy, paymentStatusUpdateSpy };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-20T00:00:00Z"));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/bookings/[id]/cancel", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(401);
  });

  it("予約が存在しない場合は404", async () => {
    setupSupabase({ booking: null });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(404);
  });

  it("他人の予約の場合は403", async () => {
    setupSupabase({ booking: makeBooking({ user_id: "other-user" }) });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(403);
  });

  it("既にキャンセル済みの場合は400", async () => {
    setupSupabase({ booking: makeBooking({ status: "cancelled" }) });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("既にキャンセル済み");
  });

  it("イベント終了後（開始2時間経過後）は400で返金・ポイント取消も行わない", async () => {
    setupSupabase({
      booking: makeBooking({ events: { start_at: "2026-07-19T21:00:00Z", price: 3000, title: "Yoga" } }),
    });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(400);
    expect(mocks.revokeEventPoints).not.toHaveBeenCalled();
  });

  it("2日以上前・Square決済: amount_charged で返金し、ポイントも取り消す", async () => {
    const { paymentStatusUpdateSpy } = setupSupabase({
      booking: makeBooking({ amount_charged: 2500, points_used: 0 }),
    });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "sq-payment-1",
        amountMoney: { amount: BigInt(2500), currency: "JPY" },
      })
    );
    expect(paymentStatusUpdateSpy).toHaveBeenCalledWith({ payment_status: "refunded" });
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled(); // pointsUsed=0
    expect(mocks.revokeEventPoints).toHaveBeenCalledWith(expect.anything(), "user-1", "booking-1");
  });

  it("2日以上前・PayPay決済・ポイント使用あり: PayPay返金とポイント払い戻しの両方を行う", async () => {
    setupSupabase({
      booking: makeBooking({ payment_method: "paypay", payment_id: "pp-1", amount_charged: 1000, points_used: 2000 }),
    });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(200);
    expect(mocks.paypayRefund).toHaveBeenCalledWith(["pp-1", expect.any(String), 1000]);
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", "booking-1");
  });

  it("前日キャンセル（2日ルール対象外）: 返金もポイント払い戻しも行わないが、参加ポイントの取消は行う", async () => {
    const { paymentStatusUpdateSpy } = setupSupabase({
      booking: makeBooking({ events: { start_at: "2026-07-21T00:00:00Z", price: 3000, title: "Yoga" }, points_used: 500 }),
    });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(paymentStatusUpdateSpy).not.toHaveBeenCalled();
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
    expect(mocks.revokeEventPoints).toHaveBeenCalled();
    expect(mocks.sendCancellationNotification).toHaveBeenCalledWith(
      expect.objectContaining({ refunded: false })
    );
  });

  it("無料イベント（未決済）: 返金APIを一切呼ばない", async () => {
    setupSupabase({
      booking: makeBooking({ payment_method: "free", payment_status: "free", payment_id: null, amount_charged: 0 }),
    });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });

    expect(res.status).toBe(200);
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(mocks.paypayRefund).not.toHaveBeenCalled();
    expect(mocks.revokeEventPoints).toHaveBeenCalled();
  });

  it("二重キャンセル競合（同時リクエスト）: claim失敗時は400を返し返金処理をしない", async () => {
    setupSupabase({ booking: makeBooking(), claimed: null, claimError: { message: "no rows" } });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("既にキャンセル済み");
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(mocks.revokeEventPoints).not.toHaveBeenCalled();
  });

  it("Square返金APIが失敗した場合は500を返す（予約は既にキャンセル済み扱い）", async () => {
    mocks.refundPayment.mockRejectedValueOnce(new Error("card network error"));
    setupSupabase({ booking: makeBooking() });

    const res = await POST(DUMMY_REQUEST, { params: { id: "booking-1" } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("card network error");
    expect(mocks.revokeEventPoints).not.toHaveBeenCalled();
  });
});
