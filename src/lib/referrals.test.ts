import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  awardPoints: vi.fn().mockResolvedValue({ awarded: true }),
  checkReferralBadges: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/points", () => ({ awardPoints: mocks.awardPoints }));
vi.mock("@/lib/badges", () => ({ checkReferralBadges: mocks.checkReferralBadges }));

const { checkAndAwardReferralReward } = await import("./referrals");

// システム時刻: 2026-07-20T05:00:00Z
const NOW = "2026-07-20T05:00:00Z";
const ENDED_EVENT = { start_at: "2026-07-20T01:00:00Z", end_at: "2026-07-20T03:00:00Z" };
const FUTURE_EVENT = { start_at: "2099-01-01T00:00:00Z", end_at: "2099-01-01T02:00:00Z" };

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

  it("pending だがチェックイン済み・終了済みイベントが無ければ付与しない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "pending" } }));
    from.mockReturnValueOnce(
      chainable({ data: [{ checked_in_at: NOW, events: FUTURE_EVENT }] })
    );

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(mocks.awardPoints).not.toHaveBeenCalled();
    expect(mocks.checkReferralBadges).not.toHaveBeenCalled();
  });

  it("pending かつチェックイン済み・終了済みイベントありなら双方に200pt付与し rewarded にする", async () => {
    const { supabase, from } = createSupabaseMock();
    const notSpy = vi.fn();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "pending" } }));
    from.mockReturnValueOnce(
      chainable({ data: [{ checked_in_at: "2026-07-20T02:00:00Z", events: ENDED_EVENT }] }, { not: notSpy })
    );
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

  it("end_at 未設定のイベントは start_at + 2時間を終了とみなす", async () => {
    const { supabase, from } = createSupabaseMock();
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ data: { id: "r1", referrer_id: "u-ref", status: "pending" } }));
    // start 01:00Z、end_at なし → 03:00Z 終了。現在 05:00Z なので終了済み
    from.mockReturnValueOnce(
      chainable({ data: [{ checked_in_at: "2026-07-20T01:30:00Z", events: { start_at: "2026-07-20T01:00:00Z", end_at: null } }] })
    );
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    await checkAndAwardReferralReward(supabase, "referee-1");

    expect(mocks.awardPoints).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalled();
  });
});
