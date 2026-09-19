import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";
import { getJstParts } from "@/lib/date";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));
vi.mock("@/lib/encrypt", () => ({
  encrypt: (text: string) => `enc(${text})`,
}));

const { POST } = await import("./route");

type Body = Record<string, unknown>;

function makeRequest(body: Body) {
  return { json: async () => body } as unknown as NextRequest;
}

function validBody(overrides: Body = {}): Body {
  return {
    name: "山田 太郎",
    nameRoman: "Yamada Taro",
    nickname: "taro",
    gender: "male",
    birthDate: "2000-01-15",
    ...overrides,
  };
}

function setup({
  user = { id: "user-1" } as { id: string } | null,
  profileUpdateError = null as { message: string } | null,
  referrer = null as { id: string } | null,
  existingReferral = null as { id: string } | null,
} = {}) {
  const profileUpdateSpy = vi.fn();
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi
      .fn()
      .mockReturnValue(chainable({ data: null, error: profileUpdateError }, { update: profileUpdateSpy })),
  });

  const referralInsertSpy = vi.fn();
  const referralCodeEqSpy = vi.fn();
  const svcFrom = vi.fn((table: string) => {
    if (table === "profiles") {
      return chainable({ data: referrer, error: null }, { eq: referralCodeEqSpy });
    }
    return chainable({ data: existingReferral, error: null }, { insert: referralInsertSpy });
  });
  mocks.createServiceClient.mockReturnValue({ from: svcFrom });

  return { profileUpdateSpy, referralInsertSpy, referralCodeEqSpy, svcFrom };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

describe("POST /api/signup/profile: 認証・レート制限", () => {
  it("未認証は401", async () => {
    setup({ user: null });
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(401);
  });

  it("レート制限超過は429で、保存しない", async () => {
    const { profileUpdateSpy } = setup();
    mocks.checkRateLimit.mockResolvedValue(false);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(429);
    expect(profileUpdateSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/signup/profile: 入力バリデーション", () => {
  it.each([
    ["name が空", { name: "" }],
    ["name に数字を含む", { name: "Taro1" }],
    ["name が31文字以上", { name: "あ".repeat(31) }],
    ["nickname が無い", { nickname: undefined }],
    ["nickname が21文字", { nickname: "a".repeat(21) }],
    ["nickname が絵文字のみ", { nickname: "😀😀" }],
    ["gender が不正値", { gender: "unknown" }],
    ["gender が無い", { gender: undefined }],
    ["birthDate が形式不正", { birthDate: "2000/01/15" }],
    ["birthDate が無い", { birthDate: undefined }],
    ["birthDate の年が1900未満", { birthDate: "1899-12-31" }],
    ["birthDate が未来の年", { birthDate: `${getJstParts(new Date()).year + 1}-01-01` }],
    ["nameRoman に数字を含む", { nameRoman: "Taro123" }],
    ["referralCode が小文字", { referralCode: "abc123" }],
    ["referralCode が21文字", { referralCode: "A".repeat(21) }],
  ])("%s は400で、保存しない", async (_label, overrides) => {
    const { profileUpdateSpy } = setup();
    const res = await POST(makeRequest(validBody(overrides)));
    expect(res.status).toBe(400);
    expect(profileUpdateSpy).not.toHaveBeenCalled();
  });

  it("長音（マクロン）入りのローマ字氏名を受け付ける（BUG-1 回帰防止）", async () => {
    setup();
    const res = await POST(makeRequest(validBody({ nameRoman: "Gō Yūta" })));
    expect(res.status).toBe(200);
  });

  it("nickname が20文字ちょうどなら受け付ける", async () => {
    setup();
    const res = await POST(makeRequest(validBody({ nickname: "a".repeat(20) })));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/signup/profile: 保存内容", () => {
  it("氏名・性別・生年月日は暗号化し、ニックネームだけ平文（前後空白は除去）で保存する", async () => {
    const { profileUpdateSpy } = setup();
    const res = await POST(makeRequest(validBody({ nickname: "  taro  " })));
    expect(res.status).toBe(200);
    expect(profileUpdateSpy).toHaveBeenCalledWith({
      name: "enc(山田 太郎)",
      name_roman: "enc(Yamada Taro)",
      nickname: "taro",
      gender: "enc(male)",
      birth_date: "enc(2000-01-15)",
    });
  });

  it("nameRoman を省略した場合は name_roman を更新対象に含めない", async () => {
    const { profileUpdateSpy } = setup();
    await POST(makeRequest(validBody({ nameRoman: undefined })));
    expect(profileUpdateSpy.mock.calls[0][0]).not.toHaveProperty("name_roman");
  });

  it("紹介コードは暗号化して referral_code_used に保存する", async () => {
    const { profileUpdateSpy } = setup();
    await POST(makeRequest(validBody({ referralCode: "ABC123" })));
    expect(profileUpdateSpy.mock.calls[0][0].referral_code_used).toBe("enc(ABC123)");
  });

  it("profiles 更新に失敗したら500で、referrals は作らない", async () => {
    const { referralInsertSpy } = setup({
      profileUpdateError: { message: "db error" },
      referrer: { id: "referrer-1" },
    });
    const res = await POST(makeRequest(validBody({ referralCode: "ABC123" })));
    expect(res.status).toBe(500);
    expect(referralInsertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/signup/profile: 紹介", () => {
  it("紹介コードが無ければ service クライアントを使わない", async () => {
    setup();
    await POST(makeRequest(validBody()));
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it("紹介者が見つかれば referrals を pending で作成する（この時点でポイントは付与しない）", async () => {
    const { referralInsertSpy, svcFrom, referralCodeEqSpy } = setup({ referrer: { id: "referrer-1" } });
    const res = await POST(makeRequest(validBody({ referralCode: "ABC123" })));
    expect(res.status).toBe(200);
    expect(referralCodeEqSpy).toHaveBeenCalledWith("referral_code", "ABC123");
    expect(referralInsertSpy).toHaveBeenCalledWith({
      referrer_id: "referrer-1",
      referee_id: "user-1",
      status: "pending",
    });
    const touchedTables = svcFrom.mock.calls.map((c) => c[0]);
    expect(touchedTables).not.toContain("points_log");
  });

  it("同じ紹介関係が既にあれば重複作成しない", async () => {
    const { referralInsertSpy } = setup({
      referrer: { id: "referrer-1" },
      existingReferral: { id: "referral-1" },
    });
    const res = await POST(makeRequest(validBody({ referralCode: "ABC123" })));
    expect(res.status).toBe(200);
    expect(referralInsertSpy).not.toHaveBeenCalled();
  });

  it("紹介コードに該当する紹介者がいなくても登録自体は成功し、referrals は作らない", async () => {
    const { referralInsertSpy } = setup({ referrer: null });
    const res = await POST(makeRequest(validBody({ referralCode: "NOSUCH" })));
    expect(res.status).toBe(200);
    expect(referralInsertSpy).not.toHaveBeenCalled();
  });
});
