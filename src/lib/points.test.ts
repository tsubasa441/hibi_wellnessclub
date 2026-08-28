import { describe, expect, it, vi } from "vitest";
import {
  awardBadgeCountPoints,
  awardPoints,
  checkAndAwardPendingPoints,
  refundUsedPoints,
  revokeEventPoints,
  spendPointsForBooking,
} from "@/lib/points";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

describe("awardPoints", () => {
  it("付与に成功した場合 increment_points を呼び、awarded:true を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ error: null }));
    rpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await awardPoints(supabase, "user-1", 30, "event_participation", "booking-1");

    expect(result).toEqual({ awarded: true, points: 30 });
    expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 30 });
  });

  it("unique制約違反（二重付与）の場合 increment_points を呼ばず awarded:false を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ error: { code: "23505" } }));

    const result = await awardPoints(supabase, "user-1", 30, "event_participation", "booking-1");

    expect(result).toEqual({ awarded: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("spendPointsForBooking", () => {
  it("充当ポイントが0以下の場合は supabase を呼ばず true を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();

    const result = await spendPointsForBooking(supabase, "user-1", 0, "booking-1");

    expect(result).toBe(true);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("残高不足で spend_points が false を返した場合 false を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    rpc.mockResolvedValueOnce({ data: false, error: null });

    const result = await spendPointsForBooking(supabase, "user-1", 500, "booking-1");

    expect(result).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("充当に成功した場合 points_log に -points で記録し true を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    rpc.mockResolvedValueOnce({ data: true, error: null }); // spend_points
    const insert = vi.fn().mockReturnValueOnce(Promise.resolve({ error: null }));
    from.mockReturnValueOnce(chainable(undefined, { insert }));

    const result = await spendPointsForBooking(supabase, "user-1", 500, "booking-1");

    expect(result).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "booking_discount", reference_id: "booking-1", points: -500 })
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("ログ記録に失敗した場合は充当を取り消し（rollback）false を返す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    rpc.mockResolvedValueOnce({ data: true, error: null }); // spend_points
    const insert = vi.fn().mockReturnValueOnce(Promise.resolve({ error: { message: "insert failed" } }));
    from.mockReturnValueOnce(chainable(undefined, { insert }));
    rpc.mockResolvedValueOnce({ data: null, error: null }); // rollback increment_points

    const result = await spendPointsForBooking(supabase, "user-1", 500, "booking-1");

    expect(result).toBe(false);
    expect(rpc).toHaveBeenNthCalledWith(2, "increment_points", { uid: "user-1", amount: 500 });
  });
});

describe("refundUsedPoints", () => {
  it("該当ログがない場合は何もしない", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: null }));

    await refundUsedPoints(supabase, "user-1", "booking-1");

    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("充当ポイントを絶対値で払い戻す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { id: "log-1", points: -500 } }));
    from.mockReturnValueOnce(chainable({ error: null })); // delete
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await refundUsedPoints(supabase, "user-1", "booking-1");

    expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 500 });
  });
});

describe("revokeEventPoints", () => {
  it("該当ログがない場合は何もしない", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: null }));

    await revokeEventPoints(supabase, "user-1", "booking-1");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("イベント参加ポイントを decrement_points で取り消す", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { id: "log-1", points: 30 } }));
    from.mockReturnValueOnce(chainable({ error: null })); // delete
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await revokeEventPoints(supabase, "user-1", "booking-1");

    expect(rpc).toHaveBeenCalledWith("decrement_points", { uid: "user-1", amount: 30 });
  });
});

describe("checkAndAwardPendingPoints", () => {
  // 過去日時（イベント終了済み）・十分に過去の月
  const PAST_EVENT_ISO = "2026-06-15T05:00:00.000Z"; // JST 14:00、当月はとうに終了
  const FUTURE_EVENT_ISO = "2099-01-01T00:00:00.000Z";

  it("終了済み予約にランク別のイベント参加ポイントを付与する", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { rank_level: 4 } })); // profiles（Leaf = 40pt）
    from.mockReturnValueOnce(
      chainable({ data: [{ id: "b1", event_id: "e1", events: { start_at: PAST_EVENT_ISO } }] })
    ); // bookings
    from.mockReturnValueOnce(chainable({ error: null })); // points_log insert（参加pt）
    from.mockReturnValueOnce(chainable({ data: [{ id: "e1" }, { id: "e2" }] })); // 当月の公開イベント
    from.mockReturnValueOnce(chainable({ data: [{ event_id: "e1" }] })); // 当月の予約（全部ではない）

    await checkAndAwardPendingPoints(supabase, "user-1");

    expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 40 });
    expect(rpc).not.toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 500 });
  });

  it("終了した月の公開イベントに全参加していれば月間ボーナス500ptを付与する", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { rank_level: 1 } })); // profiles（Seed = 30pt）
    from.mockReturnValueOnce(
      chainable({ data: [{ id: "b1", event_id: "e1", events: { start_at: PAST_EVENT_ISO } }] })
    ); // bookings
    from.mockReturnValueOnce(chainable({ error: null })); // points_log insert（参加pt）
    from.mockReturnValueOnce(chainable({ data: [{ id: "e1" }] })); // 当月の公開イベント（1件）
    from.mockReturnValueOnce(chainable({ data: [{ event_id: "e1" }] })); // 当月の予約（全参加）
    from.mockReturnValueOnce(chainable({ error: null })); // points_log insert（月間ボーナス）

    await checkAndAwardPendingPoints(supabase, "user-1");

    expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 30 });
    expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: 500 });
  });

  it("終了済み予約が無い場合は何も付与しない", async () => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { rank_level: 1 } })); // profiles
    from.mockReturnValueOnce(
      chainable({ data: [{ id: "b1", event_id: "e1", events: { start_at: FUTURE_EVENT_ISO } }] })
    ); // bookings（未来のみ）

    await checkAndAwardPendingPoints(supabase, "user-1");

    expect(from).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("awardBadgeCountPoints", () => {
  it.each([
    [2, 0],
    [3, 300],
    [4, 300],
    [5, 500],
    [8, 500],
    [9, 1000],
    [12, 1000],
  ])("バッジ%d個の月は%dpt付与する", async (badgeCount, expectedPoints) => {
    const { supabase, from, rpc } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ count: badgeCount }));
    if (expectedPoints > 0) {
      from.mockReturnValueOnce(chainable({ error: null })); // awardPoints内のinsert
      rpc.mockResolvedValueOnce({ data: null, error: null });
    }

    await awardBadgeCountPoints(supabase, "user-1", "2026-07");

    if (expectedPoints === 0) {
      expect(rpc).not.toHaveBeenCalled();
    } else {
      expect(rpc).toHaveBeenCalledWith("increment_points", { uid: "user-1", amount: expectedPoints });
    }
  });
});
