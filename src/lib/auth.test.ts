import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser } from "./auth";

function clientWith(getClaims: () => Promise<unknown>) {
  return { auth: { getClaims } } as unknown as SupabaseClient;
}

describe("getSessionUser", () => {
  it("claims から id とメールアドレスを返す", async () => {
    const supabase = clientWith(async () => ({
      data: { claims: { sub: "user-1", email: "a@example.com" } },
      error: null,
    }));
    expect(await getSessionUser(supabase)).toEqual({ id: "user-1", email: "a@example.com" });
  });

  it("メールアドレスが無い claims は email を null にする", async () => {
    const supabase = clientWith(async () => ({ data: { claims: { sub: "user-2" } }, error: null }));
    expect(await getSessionUser(supabase)).toEqual({ id: "user-2", email: null });
  });

  it("未ログイン（data が null）なら null", async () => {
    const supabase = clientWith(async () => ({ data: null, error: { message: "no session" } }));
    expect(await getSessionUser(supabase)).toBeNull();
  });

  it("sub が無い claims は null", async () => {
    const supabase = clientWith(async () => ({ data: { claims: {} }, error: null }));
    expect(await getSessionUser(supabase)).toBeNull();
  });

  it("getClaims を1回だけ呼ぶ（認証サーバーへ getUser を送らない）", async () => {
    const getClaims = vi.fn(async () => ({ data: { claims: { sub: "u" } }, error: null }));
    await getSessionUser(clientWith(getClaims));
    expect(getClaims).toHaveBeenCalledTimes(1);
  });
});
