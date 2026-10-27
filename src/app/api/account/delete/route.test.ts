import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  deleteUser: vi.fn(),
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
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();

function setup({
  isAdmin = false,
  bookings = [] as { id: string; event_start_at: string | null; event_end_at: string | null }[],
  deleteError = null as { message: string } | null,
} = {}) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } } });
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: vi.fn((table: string) =>
      table === "profiles" ? chainable({ data: { is_admin: isAdmin }, error: null }) : chainable({ data: bookings, error: null })
    ),
  });
  mocks.deleteUser.mockResolvedValue({ data: {}, error: deleteError });
  mocks.createServiceClient.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

describe("POST /api/account/delete", () => {
  it("未認証は401", async () => {
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    expect((await POST(DUMMY_REQUEST)).status).toBe(401);
  });

  it("レート制限超過は429", async () => {
    setup();
    mocks.checkRateLimit.mockResolvedValue(false);
    expect((await POST(DUMMY_REQUEST)).status).toBe(429);
  });

  it("管理者アカウントは400で拒否され、削除しない", async () => {
    setup({ isAdmin: true });
    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("管理者");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("これからのイベントの予約があれば400で、削除しない", async () => {
    setup({ bookings: [{ id: "b1", event_start_at: iso(24), event_end_at: iso(26) }] });
    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("キャンセルしてから");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("終了時刻が未設定の予約は開始+2時間で終了とみなす（開催中なら削除しない）", async () => {
    setup({ bookings: [{ id: "b1", event_start_at: iso(-1), event_end_at: null }] });
    expect((await POST(DUMMY_REQUEST)).status).toBe(400);
  });

  it("終了した予約だけなら、ログイン情報を削除して200（予約は DB 側で user_id が null になって残る）", async () => {
    setup({ bookings: [{ id: "b1", event_start_at: iso(-48), event_end_at: iso(-46) }] });
    const res = await POST(DUMMY_REQUEST);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("削除に失敗したら500", async () => {
    setup({ deleteError: { message: "auth error" } });
    expect((await POST(DUMMY_REQUEST)).status).toBe(500);
  });
});
