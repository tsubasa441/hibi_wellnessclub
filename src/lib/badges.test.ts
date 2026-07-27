import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkEventBadges, checkReferralBadges } from "@/lib/badges";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

// currentYearMonth() が参照する「今月」を固定するため、月をまたいでテストが揺れないようにする
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 15)); // 2026-07-15
});

afterEach(() => {
  vi.useRealTimers();
});

function mockBadgeAward(from: ReturnType<typeof createSupabaseMock>["from"], badgeId: string) {
  const insert = vi.fn();
  from.mockReturnValueOnce(chainable({ data: { id: badgeId } })); // badges select
  from.mockReturnValueOnce(chainable(undefined, { insert })); // user_badges insert
  return insert;
}

describe("checkEventBadges", () => {
  it("今月の確定予約がなければバッジ判定を行わない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [] })); // bookings

    await checkEventBadges(supabase, "user-1");

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("1種目のみ初参加した場合はその種目の初参加バッジだけ判定し、回数バッジは判定しない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [{ events: { event_type: "yoga" } }] })); // bookings
    const insert = mockBadgeAward(from, "badge-yoga-first");

    await checkEventBadges(supabase, "user-1");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", badge_id: "badge-yoga-first", period: "2026-07" })
    );
    // bookings + (badges select, insert) の3回のみ。回数バッジ分の呼び出しは発生しない
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("同月3回参加すると種目初参加バッジと3 Classesバッジの両方が付与される", async () => {
    const { supabase, from } = createSupabaseMock();
    const bookings = Array.from({ length: 3 }, () => ({ events: { event_type: "training" } }));
    from.mockReturnValueOnce(chainable({ data: bookings }));
    const firstBadgeInsert = mockBadgeAward(from, "badge-training-first");
    const countBadgeInsert = mockBadgeAward(from, "badge-3classes");

    await checkEventBadges(supabase, "user-1");

    expect(firstBadgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ badge_id: "badge-training-first" })
    );
    expect(countBadgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ badge_id: "badge-3classes" })
    );
    expect(from).toHaveBeenCalledTimes(5);
  });

  it("同月5回参加すると3 Classesと5 Classesの両方が付与される", async () => {
    const { supabase, from } = createSupabaseMock();
    const bookings = Array.from({ length: 5 }, () => ({ events: { event_type: "training" } }));
    from.mockReturnValueOnce(chainable({ data: bookings }));
    mockBadgeAward(from, "badge-training-first");
    const badge3 = mockBadgeAward(from, "badge-3classes");
    const badge5 = mockBadgeAward(from, "badge-5classes");

    await checkEventBadges(supabase, "user-1");

    expect(badge3).toHaveBeenCalledWith(expect.objectContaining({ badge_id: "badge-3classes" }));
    expect(badge5).toHaveBeenCalledWith(expect.objectContaining({ badge_id: "badge-5classes" }));
    expect(from).toHaveBeenCalledTimes(7);
  });

  it("バッジマスタが存在しない場合は user_badges への insert を行わない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [{ events: { event_type: "yoga" } }] })); // bookings
    from.mockReturnValueOnce(chainable({ data: null })); // badges select（マスタ不在）

    await checkEventBadges(supabase, "user-1");

    // bookings + badges select の2回のみ。insert は呼ばれない
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe("checkReferralBadges", () => {
  it("今月の紹介実績が0件ならバッジを付与しない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ count: 0 }));

    await checkReferralBadges(supabase, "user-1");

    expect(from).toHaveBeenCalledTimes(1);
  });

  it("2人紹介した場合は Bridge Builder（1人）のみ付与される", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ count: 2 }));
    const insert = mockBadgeAward(from, "badge-bridge-builder");

    await checkReferralBadges(supabase, "user-1");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ badge_id: "badge-bridge-builder", period: "2026-07" })
    );
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("5人紹介した場合は1人・3人・5人の全バッジが付与される", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ count: 5 }));
    const b1 = mockBadgeAward(from, "badge-1");
    const b3 = mockBadgeAward(from, "badge-3");
    const b5 = mockBadgeAward(from, "badge-5");

    await checkReferralBadges(supabase, "user-1");

    expect(b1).toHaveBeenCalled();
    expect(b3).toHaveBeenCalled();
    expect(b5).toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(7);
  });
});
