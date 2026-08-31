import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  getUserById: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: mocks.isAdmin,
}));

vi.mock("@/lib/encrypt", () => ({
  decrypt: (v: string) => `復号:${v}`,
}));

const { GET } = await import("./route");

const DUMMY_REQUEST = {} as NextRequest;

function setupServiceClient() {
  mocks.createServiceClient.mockReturnValue({
    auth: { admin: { getUserById: mocks.getUserById } },
  });
}

describe("GET /api/admin/events/[id]/participants/export", () => {
  it("未認証の場合は401を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });

    const res = await GET(DUMMY_REQUEST, { params: { id: "event-1" } });

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await GET(DUMMY_REQUEST, { params: { id: "event-1" } });

    expect(res.status).toBe(403);
  });

  it("参加者が0人の場合はヘッダー相当のBOMのみのCSVを返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    setupServiceClient();
    from.mockReturnValueOnce(chainable({ data: [], error: null }));
    from.mockReturnValueOnce(chainable({ data: [], error: null }));

    const res = await GET(DUMMY_REQUEST, { params: { id: "event-1" } });
    const buffer = await res.arrayBuffer();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="participants-event-1.csv"');
    // BOM（EF BB BF）が先頭に付与されていること（Response#text() はデコード時にBOMを除去してしまうため生バイトで検証）
    expect(new Uint8Array(buffer.slice(0, 3))).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });

  it("参加者がいる場合は氏名を復号しメールを取得してCSVに含める", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    setupServiceClient();
    mocks.getUserById.mockResolvedValueOnce({ data: { user: { email: "taro@example.com" } } });

    from.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "booking-1",
            user_id: "user-1",
            payment_method: "square",
            payment_status: "paid",
            points_used: 100,
            amount_charged: 2000,
            created_at: "2026-08-01T00:00:00Z",
            profiles: { name: "enc:taro" },
          },
        ],
        error: null,
      })
    );
    from.mockReturnValueOnce(
      chainable({
        data: [{ label: "Tシャツサイズ", sort_order: 0 }],
        error: null,
      })
    );

    const res = await GET(DUMMY_REQUEST, { params: { id: "event-1" } });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(mocks.getUserById).toHaveBeenCalledWith("user-1");
    expect(text).toContain("復号:enc:taro");
    expect(text).toContain("taro@example.com");
    expect(text).toContain("Square");
    expect(text).toContain("支払済み");
  });
});
