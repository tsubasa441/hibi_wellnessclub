import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  awardPoints: vi.fn().mockResolvedValue({ awarded: true }),
  checkReferralBadges: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/points", () => ({ awardPoints: mocks.awardPoints }));
vi.mock("@/lib/badges", () => ({ checkReferralBadges: mocks.checkReferralBadges }));

const { checkAndAwardReferralReward, countReferralReach } = await import("./referrals");

// システム時刻: 2026-07-20T05:00:00Z
const NOW = "2026-07-20T05:00:00Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkAndAwardReferralReward", () => {
  it("referral が無ければ何もしない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: null }));

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(from).toHaveBeenCalledTimes(1);
    expect(mocks.awardPoints).not.toHaveBeenCalled();
  });

  it("referral が既に rewarded なら何もしない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "rewarded" } }));

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(from).toHaveBeenCalledTimes(1);
    expect(mocks.awardPoints).not.toHaveBeenCalled();
  });

  it("pending だがチェックイン済みの予約が無ければ付与しない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "pending" } }));
    from.mockReturnValueOnce(chainable({ count: 0 }));

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(mocks.awardPoints).not.toHaveBeenCalled();
    expect(mocks.checkReferralBadges).not.toHaveBeenCalled();
  });

  it("pending かつチェックイン済みの予約があれば（イベント終了前でも）双方に200pt付与し rewarded にする", async () => {
    const { supabase, from } = createSupabaseMock();
    const notSpy = vi.fn();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "pending" } }));
    from.mockReturnValueOnce(chainable({ count: 1 }, { not: notSpy }));
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(notSpy).toHaveBeenCalledWith("checked_in_at", "is", null);
    expect(mocks.awardPoints).toHaveBeenCalledWith(supabase, "u-ref", 200, "referral_reward", "r1");
    expect(mocks.awardPoints).toHaveBeenCalledWith(supabase, "referee-1", 200, "referral_joined", "r1");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rewarded", rewarded_at: expect.any(String) })
    );
    expect(mocks.checkReferralBadges).toHaveBeenCalledWith(supabase, "u-ref");
  });
});

describe("countReferralReach", () => {
  it("紹介した人がいなければ 0（2代目は数えに行かない）", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [] }));

    expect(await countReferralReach(supabase, "me")).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("1代目の rewarded と、1代目全員が紹介した2代目の rewarded を合計する", async () => {
    const { supabase, from } = createSupabaseMock();
    const inSpy = vi.fn();
    const eqSpy = vi.fn();
    from.mockReturnValueOnce(
      chainable({
        data: [
          { referee_id: "a", status: "rewarded" },
          { referee_id: "b", status: "pending" },
        ],
      })
    );
    from.mockReturnValueOnce(chainable({ count: 3 }, { in: inSpy, eq: eqSpy }));

    expect(await countReferralReach(supabase, "me")).toBe(1 + 3);
    // 未参加（pending）の1代目が紹介した人も、2代目として数える対象に含める
    expect(inSpy).toHaveBeenCalledWith("referrer_id", ["a", "b"]);
    expect(eqSpy).toHaveBeenCalledWith("status", "rewarded");
  });

  it("2代目の件数が取れなければ 1代目のみ", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [{ referee_id: "a", status: "rewarded" }] }));
    from.mockReturnValueOnce(chainable({ count: null }));

    expect(await countReferralReach(supabase, "me")).toBe(1);
  });
});
