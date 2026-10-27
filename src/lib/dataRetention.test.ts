import { describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";
import { deleteOldRateLimits, deleteStaleSupportThreads } from "./dataRetention";

const NOW = new Date("2026-10-27T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe("deleteStaleSupportThreads", () => {
  it("最後のやり取りから30日を過ぎたスレッドだけを削除する", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(
      chainable({
        data: [
          { user_id: "old", created_at: daysAgo(40) },
          { user_id: "old", created_at: daysAgo(31) },
          { user_id: "active", created_at: daysAgo(60) },
          { user_id: "active", created_at: daysAgo(3) },
        ],
        error: null,
      })
    );
    const inSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { in: inSpy }));

    const count = await deleteStaleSupportThreads(supabase, NOW);

    expect(count).toBe(1);
    expect(inSpy).toHaveBeenCalledWith("user_id", ["old"]);
  });

  it("対象が無ければ削除しない", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: [{ user_id: "a", created_at: daysAgo(29) }], error: null }));

    const count = await deleteStaleSupportThreads(supabase, NOW);

    expect(count).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("deleteOldRateLimits", () => {
  it("1日より古いレート制限の記録を消す", async () => {
    const { supabase, from } = createSupabaseMock();
    const ltSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { lt: ltSpy }));

    await deleteOldRateLimits(supabase, NOW);

    expect(ltSpy).toHaveBeenCalledWith("window_start", "2026-10-26T00:00:00.000Z");
  });
});
