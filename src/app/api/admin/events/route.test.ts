import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: mocks.isAdmin,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const VALID_BODY = {
  title: "朝ヨガ",
  description: "初心者向けヨガクラス",
  eventType: "yoga",
  startAt: "2026-09-01T09:00:00Z",
  endAt: "2026-09-01T10:00:00Z",
  location: "渋谷スタジオ",
  capacity: 20,
  price: 3000,
  status: "draft",
};

describe("POST /api/admin/events", () => {
  it("未認証の場合は401を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
  });

  it("必須項目が欠けている場合は400を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const res = await POST(makeRequest({ ...VALID_BODY, title: "" }));

    expect(res.status).toBe(400);
  });

  it("終了日時が開始日時以前の場合は400を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const res = await POST(
      makeRequest({ ...VALID_BODY, startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T09:00:00Z" })
    );

    expect(res.status).toBe(400);
  });

  it("正常な入力の場合はイベントを作成し200を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const insertSpy = vi.fn();
    from.mockReturnValueOnce(
      chainable({ data: { id: "event-1", ...VALID_BODY }, error: null }, { insert: insertSpy })
    );

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.event.id).toBe("event-1");
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: "朝ヨガ", event_type: "yoga", capacity: 20, price: 3000, status: "draft" })
    );
  });
});
