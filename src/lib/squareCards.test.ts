import { describe, expect, it, vi, beforeEach } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  customersCreate: vi.fn(),
  cardsCreate: vi.fn(),
  cardsDisable: vi.fn(),
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

const { getOrCreateCustomerId, saveCard, disableCard, persistSavedCard } = await import("./squareCards");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateCustomerId", () => {
  it("既存の square_customer_id があればそれを返し、Square へは問い合わせない", async () => {
    const { supabase } = createSupabaseMock();
    const id = await getOrCreateCustomerId(supabase, "user-1", "existing-customer", "a@example.com");
    expect(id).toBe("existing-customer");
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("square_customer_id が無ければ Customer を作成し、profiles に保存して返す", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: { id: "new-customer" } });
    const { supabase, from } = createSupabaseMock();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    const id = await getOrCreateCustomerId(supabase, "user-1", null, "a@example.com");

    expect(id).toBe("new-customer");
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: "user-1", emailAddress: "a@example.com" })
    );
    expect(updateSpy).toHaveBeenCalledWith({ square_customer_id: "new-customer" });
  });

  it("Customer 作成が customer を返さない場合は例外を投げる", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: undefined });
    const { supabase } = createSupabaseMock();
    await expect(getOrCreateCustomerId(supabase, "user-1", null, null)).rejects.toThrow();
  });

  it("profiles への保存が失敗した場合は例外を投げる（握りつぶさない）", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: { id: "new-customer" } });
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ error: { message: "column does not exist" } }));

    await expect(getOrCreateCustomerId(supabase, "user-1", null, "a@example.com")).rejects.toThrow();
  });
});

describe("saveCard", () => {
  it("ノンスを Card on File として保存し、表示用の情報だけを返す", async () => {
    mocks.cardsCreate.mockResolvedValueOnce({
      card: { id: "card-1", cardBrand: "VISA", last4: "4242", expMonth: BigInt(12), expYear: BigInt(2030) },
    });

    const result = await saveCard("customer-1", "nonce-1");

    expect(mocks.cardsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: "nonce-1", card: { customerId: "customer-1" } })
    );
    expect(result).toEqual({ cardId: "card-1", brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030 });
  });

  it("card.id が無い応答は例外を投げる（生のカード情報は保存しない）", async () => {
    mocks.cardsCreate.mockResolvedValueOnce({ card: undefined });
    await expect(saveCard("customer-1", "nonce-1")).rejects.toThrow();
  });
});

describe("disableCard", () => {
  it("Square の disable を呼ぶ", async () => {
    mocks.cardsDisable.mockResolvedValueOnce({});
    await disableCard("card-1");
    expect(mocks.cardsDisable).toHaveBeenCalledWith({ cardId: "card-1" });
  });

  it("失敗しても例外を投げない（呼び出し元の処理を止めない）", async () => {
    mocks.cardsDisable.mockRejectedValueOnce(new Error("network"));
    await expect(disableCard("card-1")).resolves.toBeUndefined();
  });
});

describe("persistSavedCard", () => {
  it("カード情報を profiles に保存する", async () => {
    const { supabase, from } = createSupabaseMock();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await persistSavedCard(supabase, "user-1", {
      cardId: "card-1",
      brand: "VISA",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
    });

    expect(updateSpy).toHaveBeenCalledWith({
      square_card_id: "card-1",
      card_brand: "VISA",
      card_last4: "4242",
      card_exp_month: 12,
      card_exp_year: 2030,
    });
  });

  it("null を渡すと全列をクリアする（削除）", async () => {
    const { supabase, from } = createSupabaseMock();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await persistSavedCard(supabase, "user-1", null);

    expect(updateSpy).toHaveBeenCalledWith({
      square_card_id: null,
      card_brand: null,
      card_last4: null,
      card_exp_month: null,
      card_exp_year: null,
    });
  });

  it("profiles への保存が失敗した場合は例外を投げる（握りつぶさない）", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ error: { message: "column does not exist" } }));

    await expect(
      persistSavedCard(supabase, "user-1", { cardId: "card-1", brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030 })
    ).rejects.toThrow();
  });
});
