import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  checkRateLimit: vi.fn(),
  customersCreate: vi.fn(),
  cardsCreate: vi.fn(),
  cardsDisable: vi.fn().mockResolvedValue({}),
  captureException: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));
vi.mock("square", () => ({
  SquareClient: vi.fn().mockImplementation(function SquareClient() {
    return {
      customers: { create: mocks.customersCreate },
      cards: { create: mocks.cardsCreate, disable: mocks.cardsDisable },
    };
  }),
  SquareEnvironment: { Production: "production", Sandbox: "sandbox" },
}));

const { POST, DELETE } = await import("./route");

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function setupSupabase(profile: { square_customer_id: string | null; square_card_id: string | null }) {
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@example.com" } } });
  const { from } = createSupabaseMock();
  from.mockReturnValueOnce(chainable({ data: profile })); // profiles select
  const updateSpy = vi.fn();
  from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy })); // persistSavedCard / getOrCreateCustomerId 等
  from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy })); // 2回目の update（あれば）
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });
  return { from, updateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.customersCreate.mockResolvedValue({ customer: { id: "sq-customer-1" } });
  mocks.cardsCreate.mockResolvedValue({
    card: { id: "sq-card-1", cardBrand: "VISA", last4: "4242", expMonth: BigInt(12), expYear: BigInt(2030) },
  });
});

describe("POST /api/payment-methods/square", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({ sourceId: "nonce-1" }));

    expect(res.status).toBe(401);
  });

  it("レート制限を超えた場合は429", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@example.com" } } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });
    mocks.checkRateLimit.mockResolvedValueOnce(false);

    const res = await POST(makeRequest({ sourceId: "nonce-1" }));

    expect(res.status).toBe(429);
  });

  it("sourceId が無い場合は400", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@example.com" } } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });

  it("初回登録：Customer を新規作成し、カードを保存して表示用情報を返す", async () => {
    setupSupabase({ square_customer_id: null, square_card_id: null });

    const res = await POST(makeRequest({ sourceId: "nonce-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.customersCreate).toHaveBeenCalled();
    expect(mocks.cardsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "nonce-1", card: { customerId: "sq-customer-1" } })
    );
    expect(body).toEqual({ brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030 });
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
  });

  it("変更：既存のカードがあれば新しいカード保存後に無効化する", async () => {
    setupSupabase({ square_customer_id: "sq-customer-old", square_card_id: "sq-card-old" });

    const res = await POST(makeRequest({ sourceId: "nonce-2" }));

    expect(res.status).toBe(200);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.cardsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "nonce-2", card: { customerId: "sq-customer-old" } })
    );
    expect(mocks.cardsDisable).toHaveBeenCalledWith({ cardId: "sq-card-old" });
  });

  it("カード保存が想定外のエラーで失敗した場合は500で汎用の案内を返し、Sentry に記録する", async () => {
    setupSupabase({ square_customer_id: "sq-customer-old", square_card_id: null });
    mocks.cardsCreate.mockRejectedValueOnce(new Error("network error"));

    const res = await POST(makeRequest({ sourceId: "nonce-3" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("カードの登録に失敗しました");
    expect(body.error).not.toContain("network error");
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("Square がカードを拒否した場合は400で日本語の案内を返し、Square のエラー本文は返さない", async () => {
    setupSupabase({ square_customer_id: "sq-customer-old", square_card_id: "sq-card-old" });
    mocks.cardsCreate.mockRejectedValueOnce(
      Object.assign(new Error('Status code: 400 Body: {"errors":[{"code":"INVALID_CARD_DATA"}]}'), {
        errors: [{ category: "INVALID_REQUEST_ERROR", code: "INVALID_CARD_DATA", detail: "Invalid card data." }],
      })
    );

    const res = await POST(makeRequest({ sourceId: "nonce-4" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("カードがご利用いただけませんでした");
    expect(body.error).not.toContain("Status code");
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ extra: { squareErrorCodes: ["INVALID_CARD_DATA"] } })
    );
    // 失敗した場合、既存の保存カードは無効化しない
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/payment-methods/square", () => {
  it("未認証の場合は401", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: vi.fn() });

    const res = await DELETE();

    expect(res.status).toBe(401);
  });

  it("保存済みカードが無い場合は400", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@example.com" } } });
    const { from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { square_card_id: null } }));
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("登録されたカードがありません");
  });

  it("保存済みカードを無効化し、profiles のカード情報をクリアする", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "a@example.com" } } });
    const { from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { square_card_id: "sq-card-1" } }));
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.cardsDisable).toHaveBeenCalledWith({ cardId: "sq-card-1" });
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ square_card_id: null, card_brand: null, card_last4: null })
    );
  });
});
