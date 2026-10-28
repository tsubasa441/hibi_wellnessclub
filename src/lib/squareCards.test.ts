import { describe, expect, it, vi, beforeEach } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  customersCreate: vi.fn(),
  customersGet: vi.fn(),
  cardsCreate: vi.fn(),
  cardsGet: vi.fn(),
  cardsDisable: vi.fn(),
  serviceFrom: vi.fn(),
}));

vi.mock("square", () => ({
  SquareClient: vi.fn().mockImplementation(function SquareClient() {
    return {
      customers: { create: mocks.customersCreate, get: mocks.customersGet },
      cards: { create: mocks.cardsCreate, get: mocks.cardsGet, disable: mocks.cardsDisable },
    };
  }),
  SquareEnvironment: { Production: "production", Sandbox: "sandbox" },
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: mocks.serviceFrom }) }));

const { getOrCreateCustomerId, saveCard, disableOwnCard, persistSavedCard, isOwnCustomer, isOwnCard } = await import(
  "./squareCards"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isOwnCustomer / isOwnCard", () => {
  it("Customer の referenceId が本人の user_id のときだけ本人のもの", async () => {
    mocks.customersGet.mockResolvedValueOnce({ customer: { referenceId: "user-1" } });
    expect(await isOwnCustomer("cust-1", "user-1")).toBe(true);
    mocks.customersGet.mockResolvedValueOnce({ customer: { referenceId: "user-2" } });
    expect(await isOwnCustomer("cust-2", "user-1")).toBe(false);
    mocks.customersGet.mockRejectedValueOnce(new Error("not found"));
    expect(await isOwnCustomer("cust-3", "user-1")).toBe(false);
  });

  it("カードがその Customer のもので有効なときだけ本人のもの", async () => {
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-1", enabled: true } });
    expect(await isOwnCard("card-1", "cust-1")).toBe(true);
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-2", enabled: true } });
    expect(await isOwnCard("card-2", "cust-1")).toBe(false);
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-1", enabled: false } });
    expect(await isOwnCard("card-3", "cust-1")).toBe(false);
  });
});

describe("getOrCreateCustomerId", () => {
  it("本人の既存 Customer ならそれを返し、新しく作らない", async () => {
    mocks.customersGet.mockResolvedValueOnce({ customer: { referenceId: "user-1" } });
    const id = await getOrCreateCustomerId("user-1", "existing-customer", "a@example.com");
    expect(id).toBe("existing-customer");
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("profiles の Customer が他人のものなら使わず、新しく作る", async () => {
    mocks.customersGet.mockResolvedValueOnce({ customer: { referenceId: "someone-else" } });
    mocks.customersCreate.mockResolvedValueOnce({ customer: { id: "new-customer" } });
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: null }));
    const id = await getOrCreateCustomerId("user-1", "stolen-customer", null);
    expect(id).toBe("new-customer");
  });

  it("square_customer_id が無ければ Customer を作成し、service_role で profiles に保存して返す", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: { id: "new-customer" } });
    const updateSpy = vi.fn();
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    const id = await getOrCreateCustomerId("user-1", null, "a@example.com");

    expect(id).toBe("new-customer");
    expect(mocks.customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId: "user-1", emailAddress: "a@example.com" })
    );
    expect(updateSpy).toHaveBeenCalledWith({ square_customer_id: "new-customer" });
  });

  it("Customer 作成が customer を返さない場合は例外を投げる", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: undefined });
    await expect(getOrCreateCustomerId("user-1", null, null)).rejects.toThrow();
  });

  it("profiles への保存が失敗した場合は例外を投げる（握りつぶさない）", async () => {
    mocks.customersCreate.mockResolvedValueOnce({ customer: { id: "new-customer" } });
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: { message: "column does not exist" } }));
    await expect(getOrCreateCustomerId("user-1", null, "a@example.com")).rejects.toThrow();
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

describe("disableOwnCard", () => {
  it("本人の Customer のカードなら無効化する", async () => {
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-1", enabled: true } });
    mocks.cardsDisable.mockResolvedValueOnce({});
    await disableOwnCard("card-1", "cust-1");
    expect(mocks.cardsDisable).toHaveBeenCalledWith({ cardId: "card-1" });
  });

  it("他人のカード・Customer 不明なら無効化しない", async () => {
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-2", enabled: true } });
    await disableOwnCard("card-1", "cust-1");
    await disableOwnCard("card-1", null);
    expect(mocks.cardsDisable).not.toHaveBeenCalled();
  });

  it("失敗しても例外を投げない（呼び出し元の処理を止めない）", async () => {
    mocks.cardsGet.mockResolvedValueOnce({ card: { customerId: "cust-1", enabled: true } });
    mocks.cardsDisable.mockRejectedValueOnce(new Error("network"));
    await expect(disableOwnCard("card-1", "cust-1")).resolves.toBeUndefined();
  });
});

describe("persistSavedCard", () => {
  it("カード情報を service_role で profiles に保存する", async () => {
    const updateSpy = vi.fn();
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await persistSavedCard("user-1", { cardId: "card-1", brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030 });

    expect(updateSpy).toHaveBeenCalledWith({
      square_card_id: "card-1",
      card_brand: "VISA",
      card_last4: "4242",
      card_exp_month: 12,
      card_exp_year: 2030,
    });
  });

  it("null を渡すと全列をクリアする（削除）", async () => {
    const updateSpy = vi.fn();
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await persistSavedCard("user-1", null);

    expect(updateSpy).toHaveBeenCalledWith({
      square_card_id: null,
      card_brand: null,
      card_last4: null,
      card_exp_month: null,
      card_exp_year: null,
    });
  });

  it("profiles への保存が失敗した場合は例外を投げる（握りつぶさない）", async () => {
    mocks.serviceFrom.mockReturnValueOnce(chainable({ error: { message: "column does not exist" } }));
    await expect(
      persistSavedCard("user-1", { cardId: "card-1", brand: "VISA", last4: "4242", expMonth: 12, expYear: 2030 })
    ).rejects.toThrow();
  });
});
