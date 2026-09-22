import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn(),
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage }));

const { GET, POST } = await import("./route");

// next/navigation の redirect() は例外を投げて処理を打ち切る。その挙動を再現し、
// 最終的なリダイレクト先を返す
async function runGet(query: string) {
  const req = { url: `http://localhost/auth/confirm${query}` } as unknown as NextRequest;
  try {
    await GET(req);
  } catch (e) {
    return (e as Error).message.replace("REDIRECT:", "");
  }
  return null;
}

async function runPost(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const req = { url: "http://localhost/auth/confirm", formData: async () => form } as unknown as NextRequest;
  const res = await POST(req);
  const location = new URL(res.headers.get("location") ?? "http://x/");
  return { status: res.status, dest: location.pathname + location.search };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mocks.createServerClient.mockReturnValue({ auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: null } });
});

describe("GET /auth/confirm（リンクの先読みでトークンを消費しない）", () => {
  it("token_hash・type があっても検証せず、確認ページへ渡すだけ", async () => {
    const dest = await runGet("?token_hash=abc&type=recovery");
    expect(dest).toBe("/auth/verify?token_hash=abc&type=recovery");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("token_hash が無ければ確認ページへ進まず invalid_link へ", async () => {
    const dest = await runGet("?type=recovery");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
  });

  it("type が無ければ invalid_link へ", async () => {
    const dest = await runGet("?token_hash=abc");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
  });

  it("パラメータが何も無ければ invalid_link へ", async () => {
    const dest = await runGet("");
    expect(dest).toBe("/auth/reset-password?error=invalid_link");
  });

  it("next が同一サイト内のパスなら確認ページへ引き継ぐ", async () => {
    const dest = await runGet("?token_hash=abc&type=recovery&next=/home");
    expect(dest).toBe("/auth/verify?token_hash=abc&type=recovery&next=%2Fhome");
  });

  it.each([
    ["絶対URL", "https://evil.example.com"],
    ["プロトコル相対URL", "//evil.example.com"],
    ["バックスラッシュ付き", "/\\evil.example.com"],
  ])("next が外部サイトを指す場合（%s）は既定の遷移先に置き換えて引き継ぐ", async (_label, next) => {
    const dest = await runGet(`?token_hash=abc&type=recovery&next=${encodeURIComponent(next)}`);
    expect(dest).toBe(`/auth/verify?token_hash=abc&type=recovery&next=${encodeURIComponent("/auth/reset-password")}`);
  });
});

describe("POST /auth/confirm（確認ページのボタンで検証する）", () => {
  it("token_hash の検証に成功したら 303 で /auth/reset-password へ", async () => {
    const res = await runPost({ token_hash: "abc", type: "recovery", next: "" });
    expect(res).toEqual({ status: 303, dest: "/auth/reset-password" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  it("検証に失敗したら 303 で invalid_link へ（使用済み・期限切れのトークン）", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await runPost({ token_hash: "abc", type: "recovery", next: "" });
    expect(res).toEqual({ status: 303, dest: "/auth/reset-password?error=invalid_link" });
  });

  it("検証に失敗したとき、失敗の理由を Sentry に記録する（token_hash 自体は記録しない）", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403, name: "AuthApiError", message: "Email link is invalid or has expired" } });
    await runPost({ token_hash: "secret-token-value", type: "recovery", next: "" });
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Recovery link verification failed",
      expect.objectContaining({ extra: expect.objectContaining({ authErrorCode: "otp_expired", authErrorStatus: 403 }) })
    );
    expect(JSON.stringify(mocks.captureMessage.mock.calls)).not.toContain("secret-token-value");
  });

  it("検証に失敗しても、既にセッションがあれば（リンクの2回開き・二重押し）そのまま先へ進める", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "used" } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await runPost({ token_hash: "abc", type: "recovery", next: "" });
    expect(res).toEqual({ status: 303, dest: "/auth/reset-password" });
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it("token_hash が無ければ検証せず invalid_link へ", async () => {
    const res = await runPost({ type: "recovery", next: "" });
    expect(res.dest).toBe("/auth/reset-password?error=invalid_link");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("type が無ければ検証せず invalid_link へ", async () => {
    const res = await runPost({ token_hash: "abc", next: "" });
    expect(res.dest).toBe("/auth/reset-password?error=invalid_link");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("next が同一サイト内のパスならそこへ遷移する", async () => {
    const res = await runPost({ token_hash: "abc", type: "recovery", next: "/home" });
    expect(res.dest).toBe("/home");
  });

  it.each([
    ["絶対URL", "https://evil.example.com"],
    ["プロトコル相対URL", "//evil.example.com"],
    ["バックスラッシュ付き", "/\\evil.example.com"],
  ])("next が外部サイトを指す場合（%s）は既定の遷移先に置き換える", async (_label, next) => {
    const res = await runPost({ token_hash: "abc", type: "recovery", next });
    expect(res.dest).toBe("/auth/reset-password");
  });
});
