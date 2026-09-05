import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  updateUserById: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMIT_MESSAGE: "リクエストが多すぎます。しばらくしてから再度お試しください。",
}));

const { POST } = await import("./route");

const DUMMY_REQUEST = {} as NextRequest;

function setup({
  isAdmin = false,
  profileUpdateError = null,
  authUpdateError = null,
}: {
  isAdmin?: boolean;
  profileUpdateError?: { message: string } | null;
  authUpdateError?: { message: string } | null;
} = {}) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } } });
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: vi.fn().mockReturnValue(chainable({ data: { is_admin: isAdmin }, error: null })),
  });

  const profileUpdateSpy = vi.fn();
  const fromSpy = vi.fn().mockReturnValue(
    chainable({ data: null, error: profileUpdateError }, { update: profileUpdateSpy })
  );
  mocks.updateUserById.mockResolvedValue({ data: {}, error: authUpdateError });
  mocks.createServiceClient.mockReturnValue({
    from: fromSpy,
    auth: { admin: { updateUserById: mocks.updateUserById } },
  });

  return { fromSpy, profileUpdateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/account/delete", () => {
  it("未認証は401", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(401);
  });

  it("レート制限超過は429", async () => {
    setup();
    mocks.checkRateLimit.mockResolvedValue(false);

    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(429);
  });

  it("管理者アカウントは400で拒否される", async () => {
    setup({ isAdmin: true });

    const res = await POST(DUMMY_REQUEST);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain("管理者");
  });

  it("成功時、profilesを匿名化しauth.usersを無効化して200を返す", async () => {
    const { profileUpdateSpy } = setup();

    const res = await POST(DUMMY_REQUEST);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(profileUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: null,
        name_roman: null,
        nickname: "退会済みユーザー",
        gender: null,
        birth_date: null,
        referral_code_used: null,
        avatar_url: null,
      })
    );
    expect(mocks.updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        email: "deleted-user-1@deleted.invalid",
        ban_duration: "876000h",
      })
    );
  });

  it("profiles更新が失敗したら500", async () => {
    setup({ profileUpdateError: { message: "db error" } });

    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(500);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("auth.users更新が失敗したら500だがprofilesは既に匿名化済み", async () => {
    setup({ authUpdateError: { message: "auth error" } });

    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(500);
  });
});
