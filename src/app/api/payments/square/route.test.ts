import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  paymentsCreate: vi.fn(),
  refundPayment: vi.fn(),
  customersCreate: vi.fn(),
  cardsCreate: vi.fn(),
  cardsDisable: vi.fn().mockResolvedValue({}),
  sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
  checkRankUp: vi.fn().mockResolvedValue(undefined),
  checkEventBadges: vi.fn().mockResolvedValue(undefined),
  spendPointsForBooking: vi.fn(),
  refundUsedPoints: vi.fn().mockResolvedValue(undefined),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
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

vi.mock("square", () => ({
  SquareClient: vi.fn().mockImplementation(function SquareClient() {
    return {
      payments: { create: mocks.paymentsCreate },
      refunds: { refundPayment: mocks.refundPayment },
      customers: { create: mocks.customersCreate },
      cards: { create: mocks.cardsCreate, disable: mocks.cardsDisable },
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
  // amountToCharge > 0（実際に Square へ課金する）のテストでは、カード保存機能のため
  // 決済前に profiles から square_customer_id/square_card_id を読む1クエリと、
  // 決済成功後に persistSavedCard が profiles を更新する1クエリが追加で発生する
  withCardCharge = false,
  withPersistCard = false,
  cardProfile = { square_customer_id: null, square_card_id: null },
}: {
  existing?: unknown;
  event: unknown;
  count?: number;
  insertError?: unknown;
  userId?: string;
  email?: string;
  withCardCharge?: boolean;
  // persistSavedCard が呼ばれる（新しいカードでの決済に成功した）シナリオでのみ true にする
  withPersistCard?: boolean;
  cardProfile?: { square_customer_id: string | null; square_card_id: string | null };
}) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, email } } });

  const { from } = createSupabaseMock();
  from.mockReturnValueOnce(chainable({ data: existing })); // 重複予約チェック
  from.mockReturnValueOnce(chainable({ data: event })); // イベント取得

  if (withCardCharge) {
    from.mockReturnValueOnce(chainable({ data: cardProfile })); // カード保存機能: 保存済みカードの確認
    if (!cardProfile.square_customer_id) {
      from.mockReturnValueOnce(chainable({ error: null })); // getOrCreateCustomerId: 新規 Customer の square_customer_id 保存
    }
  }

  const insertSpy = vi.fn();
  from.mockReturnValueOnce(chainable({ error: insertError }, { insert: insertSpy })); // bookings insert

  // persistSavedCard（新しいカードでの決済に成功した場合のみ）は、確認メール用の
  // profiles select より先に呼ばれる
  const persistCardSpy = vi.fn();
  if (withPersistCard) {
    from.mockReturnValueOnce(chainable({ error: null }, { update: persistCardSpy })); // persistSavedCard
  }
  from.mockReturnValueOnce(chainable({ data: { name: null } })); // profiles select（確認メール用）

  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });

  // 残席カウントは service_role クライアント経由
  const serviceFrom = vi.fn().mockReturnValue(chainable({ count }));
  mocks.createServiceClient.mockReturnValue({ from: serviceFrom });

  return { from, insertSpy, serviceFrom, persistCardSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  // カード保存（顧客作成・カード保存）のデフォルトは成功とする。個々のテストで上書き可能
  mocks.customersCreate.mockResolvedValue({ customer: { id: "sq-customer-1" } });
  mocks.cardsCreate.mockResolvedValue({
    card: { id: "sq-card-1", cardBrand: "VISA", last4: "4242", expMonth: BigInt(12), expYear: BigInt(2029) },
  });
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
    // ランク・バッジは予約時ではなくチェックイン時に判定する
    expect(mocks.checkRankUp).not.toHaveBeenCalled();
    expect(mocks.checkEventBadges).not.toHaveBeenCalled();
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
    const { insertSpy } = setupSupabase({ event: makeEvent({ price: 3000 }), withCardCharge: true, withPersistCard: true });

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

  it("決済が完了しなかった場合は400を返し、充当済みポイントを払い戻し、カードは保存しない", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-2", status: "FAILED" } });
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    const { persistCardSpy } = setupSupabase({ event: makeEvent({ price: 3000 }), withCardCharge: true });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("決済に失敗");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
    // 課金してから保存する順序のため、失敗した決済のカードは Square にも profiles にも保存されない
    expect(mocks.cardsCreate).not.toHaveBeenCalled();
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
    expect(persistCardSpy).not.toHaveBeenCalled();
  });

  it("新しいカードの場合、ノンスで課金してから、成功した決済のIDでカードを保存し、既存の保存カードを無効化する", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-5", status: "COMPLETED" } });
    const { insertSpy, persistCardSpy } = setupSupabase({
      event: makeEvent({ price: 3000 }),
      withCardCharge: true,
      withPersistCard: true,
      cardProfile: { square_customer_id: "sq-customer-old", square_card_id: "sq-card-old" },
    });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-new" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, cardSaved: true });
    // 既存の customer をそのまま使う（新規作成しない）
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    // 課金はノンスで行う（Square 公式の charge-and-store の順序）
    expect(mocks.paymentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "src-new", customerId: "sq-customer-old" })
    );
    // カードの保存は、成功した決済の ID を sourceId にする
    expect(mocks.cardsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "sq-pay-5", card: { customerId: "sq-customer-old" } })
    );
    expect(mocks.paymentsCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.cardsCreate.mock.invocationCallOrder[0]);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ payment_id: "sq-pay-5" }));
    // 新しいカード情報を保存し、古いカードは無効化する
    expect(persistCardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ square_card_id: "sq-card-1", card_brand: "VISA", card_last4: "4242" })
    );
    expect(mocks.cardsDisable).toHaveBeenCalledWith({ cardId: "sq-card-old" });
  });

  it("決済成功後のカード保存に失敗しても、予約は確定し成功を返す（古いカードは残し、Sentry に記録する）", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-7", status: "COMPLETED" } });
    mocks.cardsCreate.mockRejectedValueOnce(
      Object.assign(new Error("Status code: 400"), { errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_CARD_DATA" }] })
    );
    const { insertSpy, persistCardSpy } = setupSupabase({
      event: makeEvent({ price: 3000 }),
      withCardCharge: true,
      cardProfile: { square_customer_id: "sq-customer-old", square_card_id: "sq-card-old" },
    });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-jcb" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, cardSaved: false });
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ payment_id: "sq-pay-7", payment_status: "paid" }));
    expect(mocks.refundPayment).not.toHaveBeenCalled();
    expect(persistCardSpy).not.toHaveBeenCalled();
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
    expect(mocks.sendBookingConfirmation).toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: expect.objectContaining({ area: "square_card_save" }),
        extra: { squareErrorCodes: ["INVALID_CARD_DATA"] },
      })
    );
  });

  it("カードが拒否された場合は400で日本語の案内を返し、Square のエラー本文は返さない", async () => {
    mocks.paymentsCreate.mockRejectedValueOnce(
      Object.assign(new Error('Status code: 402 Body: {"errors":[{"code":"GENERIC_DECLINE"}]}'), {
        errors: [{ category: "PAYMENT_METHOD_ERROR", code: "GENERIC_DECLINE", detail: "Authorization error" }],
      })
    );
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }), withCardCharge: true });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 500 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("カードがご利用いただけませんでした");
    expect(body.error).not.toContain("Status code");
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
    expect(mocks.cardsCreate).not.toHaveBeenCalled();
  });

  it("useSavedCard:true の場合、保存済みカードでそのまま課金し、カードの新規保存は行わない", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-6", status: "COMPLETED" } });
    const { insertSpy, persistCardSpy } = setupSupabase({
      event: makeEvent({ price: 3000 }),
      withCardCharge: true,
      cardProfile: { square_customer_id: "sq-customer-2", square_card_id: "sq-card-2" },
    });

    const res = await POST(makeRequest({ eventId: "event-1", useSavedCard: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.cardsCreate).not.toHaveBeenCalled();
    expect(mocks.paymentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "sq-card-2", customerId: "sq-customer-2" })
    );
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ payment_id: "sq-pay-6" }));
    // 保存済みカードをそのまま使った場合は profiles のカード情報を更新しない
    expect(persistCardSpy).not.toHaveBeenCalled();
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
  });

  it("useSavedCard:true だが保存済みカードが無い場合は400を返し、充当済みポイントを払い戻す", async () => {
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }), withCardCharge: true });

    const res = await POST(makeRequest({ eventId: "event-1", useSavedCard: true, pointsToUse: 500 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("保存されたカードがありません");
    expect(mocks.paymentsCreate).not.toHaveBeenCalled();
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });

  it("決済成功後に予約作成が失敗した場合、自動返金しポイントも払い戻す", async () => {
    mocks.paymentsCreate.mockResolvedValueOnce({ payment: { id: "sq-pay-3", status: "COMPLETED" } });
    mocks.refundPayment.mockResolvedValueOnce({});
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }), insertError: { message: "insert failed" }, withCardCharge: true });

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
    setupSupabase({ event: makeEvent({ price: 3000 }), insertError: { message: "insert failed" }, withCardCharge: true });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("返金処理にも失敗しました");
  });

  it("決済APIが例外を投げた場合は500で汎用の案内を返し、ポイントを払い戻す", async () => {
    mocks.paymentsCreate.mockRejectedValueOnce(new Error("network error"));
    mocks.spendPointsForBooking.mockResolvedValueOnce(true);
    setupSupabase({ event: makeEvent({ price: 3000 }), withCardCharge: true });

    const res = await POST(makeRequest({ eventId: "event-1", sourceId: "src-1", pointsToUse: 1000 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("決済を完了できませんでした");
    expect(mocks.captureException).toHaveBeenCalled();
    expect(mocks.refundUsedPoints).toHaveBeenCalledWith(expect.anything(), "user-1", expect.any(String));
  });
});
