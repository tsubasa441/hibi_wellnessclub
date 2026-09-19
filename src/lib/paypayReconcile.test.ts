import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getPaymentDetails: vi.fn(),
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  refundUsedPoints: vi.fn().mockResolvedValue(undefined),
  createServiceClient: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@paypayopa/paypayopa-sdk-node", () => ({
  default: { Configure: vi.fn(), GetCodePaymentDetails: mocks.getPaymentDetails },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException, captureMessage: mocks.captureMessage }));
vi.mock("@/lib/email", () => ({ sendBookingConfirmation: mocks.sendBookingConfirmation }));
vi.mock("@/lib/encrypt", () => ({ decrypt: (v: string) => v }));
vi.mock("@/lib/points", () => ({ refundUsedPoints: mocks.refundUsedPoints }));

const { reconcilePendingPayPayBookings, PENDING_PAYPAY_TTL_MS, UNKNOWN_STATUS_TTL_MS } = await import("./paypayReconcile");

const USER = { id: "user-1", email: "user@example.com" };

function makeBooking(overrides: Partial<{ points_used: number; ageMs: number }> = {}) {
  return {
    id: "booking-1",
    event_id: "event-1",
    user_id: "user-1",
    points_used: overrides.points_used ?? 0,
    created_at: new Date(Date.now() - (overrides.ageMs ?? 0)).toISOString(),
  };
}

function paypayResult(code: string, status?: string) {
  return { BODY: { resultInfo: { code }, data: status ? { status } : undefined } };
}

function setup({
  bookings = [makeBooking()] as ReturnType<typeof makeBooking>[],
  affectedRows = [{ id: "booking-1" }] as { id: string }[],
} = {}) {
  const selectEqSpy = vi.fn();
  const updateSpy = vi.fn();
  const deleteSpy = vi.fn();
  mocks.createServiceClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chainable({ data: affectedRows, error: null }, { update: updateSpy, delete: deleteSpy })),
  });
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "bookings") return chainable({ data: bookings, error: null }, { eq: selectEqSpy });
      if (table === "events") {
        return chainable({
          data: {
            title: "Yoga Class",
            event_type: "yoga",
            description: "desc",
            start_at: "2026-10-01T00:00:00Z",
            location: "Tokyo",
            price: 3000,
            belongings: null,
          },
          error: null,
        });
      }
      return chainable({ data: { name: "Taro" }, error: null });
    }),
  } as never;
  return { supabase, selectEqSpy, updateSpy, deleteSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reconcilePendingPayPayBookings", () => {
  it("pending の PayPay 予約が無ければ PayPay に問い合わせない", async () => {
    const { supabase } = setup({ bookings: [] });
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(mocks.getPaymentDetails).not.toHaveBeenCalled();
  });

  it("対象は本人の pending な PayPay 予約に絞り込む", async () => {
    const { supabase, selectEqSpy } = setup({ bookings: [] });
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(selectEqSpy).toHaveBeenCalledWith("user_id", "user-1");
    expect(selectEqSpy).toHaveBeenCalledWith("payment_method", "paypay");
    expect(selectEqSpy).toHaveBeenCalledWith("payment_status", "pending");
  });

  it("eventId を渡すとそのイベントの予約だけを対象にする", async () => {
    const { supabase, selectEqSpy } = setup({ bookings: [] });
    await reconcilePendingPayPayBookings(supabase, USER, { eventId: "event-9" });
    expect(selectEqSpy).toHaveBeenCalledWith("event_id", "event-9");
  });

  it("決済完了なら paid に更新し、確認メールを送る", async () => {
    const { supabase, updateSpy, deleteSpy } = setup({ bookings: [makeBooking({ points_used: 200 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "COMPLETED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(updateSpy).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", paymentMethod: "paypay", pointsUsed: 200, eventTitle: "Yoga Class" })
    );
  });

  it("別のリクエストが先に確定していた場合（更新0行）はメールを送らない", async () => {
    const { supabase } = setup({ affectedRows: [] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "COMPLETED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("未完了でも TTL 内なら何も変更しない（支払い途中の可能性）", async () => {
    const { supabase, updateSpy, deleteSpy } = setup({ bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS - 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CREATED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
  });

  it("PayPay がエラーコードを返しても TTL 内なら何も変更しない", async () => {
    const { supabase, deleteSpy } = setup({ bookings: [makeBooking({ ageMs: 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("DYNAMIC_QR_PAYMENT_NOT_FOUND"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("未知の状態（CREATED 等）やエラー応答は、TTL を過ぎても24時間以内なら削除しない（支払い済みの誤削除防止）", async () => {
    const { supabase, deleteSpy } = setup({ bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS + 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("DYNAMIC_QR_PAYMENT_NOT_FOUND"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(deleteSpy).not.toHaveBeenCalled();
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CREATED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("未知の状態でも24時間を過ぎていれば予約を削除する", async () => {
    const { supabase, deleteSpy } = setup({ bookings: [makeBooking({ ageMs: UNKNOWN_STATUS_TTL_MS + 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("DYNAMIC_QR_PAYMENT_NOT_FOUND"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("未完了の照会結果を Sentry に記録する", async () => {
    const { supabase } = setup({ bookings: [makeBooking({ ageMs: 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CREATED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "PayPay reconcile: payment not completed",
      expect.objectContaining({ extra: expect.objectContaining({ status: "CREATED" }) })
    );
  });

  it("未完了で TTL を過ぎていれば予約を削除し、充当ポイントを払い戻す", async () => {
    const { supabase, deleteSpy, updateSpy } = setup({
      bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS + 60_000, points_used: 500 })],
    });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "EXPIRED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(deleteSpy).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", "booking-1");
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("TTL 超過で削除するとき、充当ポイントが無ければ払い戻しを呼ばない", async () => {
    const { supabase } = setup({ bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS + 60_000 })] });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "EXPIRED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
  });

  it("削除が0行（別リクエストが先に処理済み）ならポイントを二重に払い戻さない", async () => {
    const { supabase } = setup({
      bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS + 60_000, points_used: 500 })],
      affectedRows: [],
    });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "EXPIRED"));
    await reconcilePendingPayPayBookings(supabase, USER);
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
  });

  it("PayPay 照会が失敗しても予約は削除せず、例外も投げず、Sentry に送る", async () => {
    const { supabase, deleteSpy } = setup({ bookings: [makeBooking({ ageMs: PENDING_PAYPAY_TTL_MS + 60_000 })] });
    mocks.getPaymentDetails.mockRejectedValue(new Error("network"));
    await expect(reconcilePendingPayPayBookings(supabase, USER)).resolves.toBeUndefined();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("メールアドレスが無くても予約の確定は行う", async () => {
    const { supabase, updateSpy } = setup();
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "COMPLETED"));
    await reconcilePendingPayPayBookings(supabase, { id: "user-1", email: null });
    expect(updateSpy).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });
});
