import { describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/admin";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

describe("isAdmin", () => {
  it("is_admin が true の場合 true を返す", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { is_admin: true }, error: null }));

    const result = await isAdmin(supabase, "user-1");

    expect(result).toBe(true);
  });

  it("is_admin が false の場合 false を返す", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: { is_admin: false }, error: null }));

    const result = await isAdmin(supabase, "user-1");

    expect(result).toBe(false);
  });

  it("プロフィールが存在しない場合 false を返す", async () => {
    const { supabase, from } = createSupabaseMock();
    from.mockReturnValueOnce(chainable({ data: null, error: { code: "PGRST116" } }));

    const result = await isAdmin(supabase, "user-1");

    expect(result).toBe(false);
  });
});
