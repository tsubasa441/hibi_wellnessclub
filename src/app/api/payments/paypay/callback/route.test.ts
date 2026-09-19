import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getPaymentDetails: vi.fn(),
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  refundUsedPoints: vi.fn().mockResolvedValue(undefined),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@paypayopa/paypayopa-sdk-node", () => ({
  default: { Configure: vi.fn(), GetPaymentDetails: mocks.getPaymentDetails },
}));
vi.mock("@/lib/email", () => ({ sendBookingConfirmation: mocks.sendBookingConfirmation }));
vi.mock("@/lib/encrypt", () => ({ decrypt: (v: string) => v }));
vi.mock("@/lib/points", () => ({ refundUsedPoints: mocks.refundUsedPoints }));

const { GET } = await import("./route");

function makeRequest(merchantPaymentId?: string) {
  const query = merchantPaymentId ? `?merchantPaymentId=${merchantPaymentId}` : "";
  return { url: `http://localhost/api/payments/paypay/callback${query}` } as unknown as NextRequest;
}

function locationOf(res: Response) {
  const url = new URL(res.headers.get("location") ?? "");
  return url.pathname + url.search;
}

function makeBooking(overrides: Partial<{ payment_status: string; points_used: number }> = {}) {
  return {
    id: "booking-1",
    event_id: "event-1",
    user_id: "user-1",
    payment_status: "pending",
    points_used: 0,
    ...overrides,
  };
}

function paypayResult(code: string, status: string) {
  return { BODY: { resultInfo: { code }, data: { status } } };
}

function setup({
  booking = makeBooking() as ReturnType<typeof makeBooking> | null,
  email = "user@example.com" as string | null,
} = {}) {
  // bookings には本人向けの UPDATE/DELETE の RLS ポリシーが無く、ユーザーのセッションでの
  // 更新・削除は黙って無視される。書き込みは service_role で行われること（= ユーザー側の
  // update/delete が呼ばれないこと）を検証する
  const updateSpy = vi.fn();
  const deleteSpy = vi.fn();
  const userUpdateSpy = vi.fn();
  const userDeleteSpy = vi.fn();
  mocks.createServiceClient.mockReturnValue({
    from: vi
      .fn()
      .mockReturnValue(chainable({ data: null, error: null }, { update: updateSpy, delete: deleteSpy })),
  });
  const from = vi.fn((table: string) => {
    if (table === "bookings") {
      return chainable({ data: booking, error: null }, { update: userUpdateSpy, delete: userDeleteSpy });
    }
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
  });
  mocks.createServerClient.mockReturnValue({
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }),
    },
  });
  return { updateSpy, deleteSpy, userUpdateSpy, userDeleteSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payments/paypay/callback", () => {
  it("merchantPaymentId が無ければエラーへリダイレクト", async () => {
    setup();
    const res = await GET(makeRequest());
    expect(locationOf(res)).toBe("/home?payment=error");
    expect(mocks.getPaymentDetails).not.toHaveBeenCalled();
  });

  it("予約が見つからなければエラーへリダイレクト", async () => {
    setup({ booking: null });
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/home?payment=error");
    expect(mocks.getPaymentDetails).not.toHaveBeenCalled();
  });

  it("既に paid なら PayPay に問い合わせず完了画面へリダイレクト（冪等）", async () => {
    const { updateSpy } = setup({ booking: makeBooking({ payment_status: "paid" }) });
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/events/event-1?booked=1");
    expect(mocks.getPaymentDetails).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("PayPay 照会が例外を投げたらエラーへリダイレクトし、予約は削除しない", async () => {
    const { deleteSpy } = setup();
    mocks.getPaymentDetails.mockRejectedValue(new Error("network"));
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/home?payment=error");
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("決済が COMPLETED でなければ pending 予約を削除して cancelled へ", async () => {
    const { deleteSpy, updateSpy, userDeleteSpy } = setup();
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CREATED"));
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/events/event-1?payment=cancelled");
    expect(deleteSpy).toHaveBeenCalled();
    expect(userDeleteSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("resultInfo が SUCCESS でなければ COMPLETED でも確定しない", async () => {
    const { deleteSpy, updateSpy } = setup();
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("INVALID_REQUEST", "COMPLETED"));
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/events/event-1?payment=cancelled");
    expect(deleteSpy).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("未完了で削除するとき、充当ポイントがあれば払い戻す", async () => {
    setup({ booking: makeBooking({ points_used: 500 }) });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CANCELED"));
    await GET(makeRequest("booking-1"));
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", "booking-1");
  });

  it("未完了で削除するとき、充当ポイントが無ければ払い戻しを呼ばない", async () => {
    setup({ booking: makeBooking({ points_used: 0 }) });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "CANCELED"));
    await GET(makeRequest("booking-1"));
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
  });

  it("決済完了なら paid に更新し、確認メールを送って完了画面へ", async () => {
    const { updateSpy, deleteSpy, userUpdateSpy } = setup({ booking: makeBooking({ points_used: 200 }) });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "COMPLETED"));
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/events/event-1?booked=1");
    expect(updateSpy).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(userUpdateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.refundUsedPoints).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        paymentMethod: "paypay",
        pointsUsed: 200,
        eventTitle: "Yoga Class",
      })
    );
  });

  it("メールアドレスが取れなくても予約確定と完了画面への遷移は行う", async () => {
    const { updateSpy } = setup({ email: null });
    mocks.getPaymentDetails.mockResolvedValue(paypayResult("SUCCESS", "COMPLETED"));
    const res = await GET(makeRequest("booking-1"));
    expect(locationOf(res)).toBe("/events/event-1?booked=1");
    expect(updateSpy).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
  });
});
