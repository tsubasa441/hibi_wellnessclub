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

const { PATCH, DELETE } = await import("./route");

function makeRequest(body: unknown = {}): NextRequest {
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
  status: "published",
};

describe("PATCH /api/admin/events/[id]", () => {
  it("未認証の場合は401を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });

    const res = await PATCH(makeRequest(VALID_BODY), { params: { id: "event-1" } });

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await PATCH(makeRequest(VALID_BODY), { params: { id: "event-1" } });

    expect(res.status).toBe(403);
  });

  it("バリデーションエラーの場合は400を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const res = await PATCH(makeRequest({ ...VALID_BODY, capacity: 0 }), { params: { id: "event-1" } });

    expect(res.status).toBe(400);
  });

  it("存在しないイベントの場合は404を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: null, error: { message: "not found" } }));

    const res = await PATCH(makeRequest(VALID_BODY), { params: { id: "missing" } });

    expect(res.status).toBe(404);
  });

  it("正常な入力の場合は更新し200を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const updateSpy = vi.fn();
    from.mockReturnValueOnce(
      chainable({ data: { id: "event-1", ...VALID_BODY }, error: null }, { update: updateSpy })
    );

    const res = await PATCH(makeRequest(VALID_BODY), { params: { id: "event-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.event.id).toBe("event-1");
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "朝ヨガ", status: "published" }));
  });
});

describe("DELETE /api/admin/events/[id]", () => {
  it("未認証の場合は401を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });

    const res = await DELETE(makeRequest(), { params: { id: "event-1" } });

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await DELETE(makeRequest(), { params: { id: "event-1" } });

    expect(res.status).toBe(403);
  });

  it("存在しないイベントの場合は404を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: null, error: null }));

    const res = await DELETE(makeRequest(), { params: { id: "missing" } });

    expect(res.status).toBe(404);
  });

  it("既に削除済み（cancelled）の場合は400を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: { id: "event-1", status: "cancelled" }, error: null }));

    const res = await DELETE(makeRequest(), { params: { id: "event-1" } });

    expect(res.status).toBe(400);
  });

  it("正常時は物理削除ではなくstatusをcancelledへ更新する", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);

    from.mockReturnValueOnce(chainable({ data: { id: "event-1", status: "published" }, error: null }));
    const updateSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy }));

    const res = await DELETE(makeRequest(), { params: { id: "event-1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ status: "cancelled" });
  });
});
