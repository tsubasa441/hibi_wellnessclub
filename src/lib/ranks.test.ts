import { describe, expect, it, vi } from "vitest";
import { checkRankUp, getNextRank, getRankByLevel } from "@/lib/ranks";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

function mockUpdate() {
  // update(...).eq(...) と続けて呼ばれるため、update() 自体は chainable を返す
  return vi.fn(() => chainable({ error: null }));
}

describe("getRankByLevel", () => {
  it("存在するレベルのランクを返す", () => {
    expect(getRankByLevel(4).nameEn).toBe("Leaf");
  });

  it("存在しないレベルの場合は最低ランク（Seed）にフォールバックする", () => {
    expect(getRankByLevel(999).nameEn).toBe("Seed");
  });
});

describe("getNextRank", () => {
  it("次のランクを返す", () => {
    expect(getNextRank(1)?.nameEn).toBe("Sprout");
  });

  it("最高ランクの場合は null を返す", () => {
    expect(getNextRank(8)).toBeNull();
  });
});

describe("checkRankUp", () => {
  it("条件を満たしたら現在ランクより高いレベルに更新する", async () => {
    const { supabase, from } = createSupabaseMock();
    const update = { fn: mockUpdate() };
    from.mockReturnValueOnce(chainable({ count: 30 })); // bookings（confirmed）
    from.mockReturnValueOnce(chainable({ count: 3 })); // referrals（rewarded）
    from.mockReturnValueOnce(chainable({ data: { rank_level: 1 } })); // profiles select
    from.mockReturnValueOnce(chainable(undefined, { update: update.fn })); // profiles update

    await checkRankUp(supabase, "user-1");

    expect(update.fn).toHaveBeenCalledWith(
      expect.objectContaining({ rank_level: 4, rank_inactive_penalty: false })
    );
  });

  it("ランクダウンはしない（現在ランクを維持する）", async () => {
    const { supabase, from } = createSupabaseMock();
    const update = { fn: mockUpdate() };
    from.mockReturnValueOnce(chainable({ count: 0 })); // bookings
    from.mockReturnValueOnce(chainable({ count: 0 })); // referrals
    from.mockReturnValueOnce(chainable({ data: { rank_level: 5 } })); // profiles select（現在Bud=5）
    from.mockReturnValueOnce(chainable(undefined, { update: update.fn }));

    await checkRankUp(supabase, "user-1");

    expect(update.fn).toHaveBeenCalledWith(
      expect.objectContaining({ rank_level: 5 })
    );
  });
});
