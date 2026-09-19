import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));

const { GET } = await import("./route");

// next/navigation の redirect() は例外を投げて処理を打ち切る。その挙動を再現し、
// 最終的なリダイレクト先を返す
async function run(query: string) {
  const req = { url: `http://localhost/auth/confirm${query}` } as unknown as NextRequest;
  try {
    await GET(req);
  } catch (e) {
    return (e as Error).message.replace("REDIRECT:", "");
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mocks.createServerClient.mockReturnValue({ auth: { verifyOtp: mocks.verifyOtp } });
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  it("token_hash の検証に成功したら /auth/reset-password へ", async () => {
    const dest = await run("?token_hash=abc&type=recovery");
    expect(dest).toBe("/auth/reset-password");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  it("検証に失敗したら invalid_link へ", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const dest = await run("?token_hash=abc&type=recovery");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
  });

  it("token_hash が無ければ検証せず invalid_link へ", async () => {
    const dest = await run("?type=recovery");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("type が無ければ検証せず invalid_link へ", async () => {
    const dest = await run("?token_hash=abc");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("パラメータが何も無ければ invalid_link へ", async () => {
    const dest = await run("");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
  });

  it("next が同一サイト内のパスならそこへ遷移する", async () => {
    const dest = await run("?token_hash=abc&type=recovery&next=/home");
    expect(dest).toBe("/home");
  });

  it.each([
    ["絶対URL", "https://evil.example.com"],
    ["プロトコル相対URL", "//evil.example.com"],
    ["バックスラッシュ付き", "/\\evil.example.com"],
  ])("next が外部サイトを指す場合（%s）は既定の遷移先に置き換える", async (_label, next) => {
    const dest = await run(`?token_hash=abc&type=recovery&next=${encodeURIComponent(next)}`);
    expect(dest).toBe("/auth/reset-password");
  });
});
