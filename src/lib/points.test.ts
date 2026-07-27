import { describe, expect, it, vi } from "vitest";
import {
  awardBadgeCountPoints,
  awardPoints,
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
