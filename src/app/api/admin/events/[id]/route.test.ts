import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { chainable, createSupabaseMock } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  isAdmin: vi.fn(),
  cancelEventBookings: vi.fn(),
}));

vi.mock("@/lib/eventCancellation", () => ({ cancelEventBookings: mocks.cancelEventBookings }));
vi.mock("@/lib/waitlist", () => ({ notifyWaitlistIfSeatsOpen: vi.fn().mockResolvedValue(0) }));
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

    const res = await PATCH(makeRequest(VALID_BODY), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await PATCH(makeRequest(VALID_BODY), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(403);
  });

  it("バリデーションエラーの場合は400を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(true);

    const res = await PATCH(makeRequest({ ...VALID_BODY, capacity: 0 }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(400);
  });

  it("存在しないイベントの場合は404を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: null, error: { message: "not found" } }));

    const res = await PATCH(makeRequest(VALID_BODY), { params: Promise.resolve({ id: "missing" }) });

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
    // event_options の置き換え（delete → 再 insert）
    from.mockReturnValueOnce(chainable({ error: null }));

    const res = await PATCH(makeRequest(VALID_BODY), { params: Promise.resolve({ id: "event-1" }) });
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

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(401);
  });

  it("管理者でない場合は403を返す", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser } });
    mocks.isAdmin.mockResolvedValueOnce(false);

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(403);
  });

  it("存在しないイベントの場合は404を返す", async () => {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: null, error: null }));

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  function setupAdmin(event: { start_at: string; end_at: string | null }) {
    const { from } = createSupabaseMock();
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "admin-1" } } });
    mocks.createServerClient.mockReturnValueOnce({ auth: { getUser: mocks.getUser }, from });
    mocks.isAdmin.mockResolvedValueOnce(true);
    from.mockReturnValueOnce(chainable({ data: { id: "event-1", status: "published", ...event }, error: null }));
    return from;
  }
  const HOUR = 60 * 60 * 1000;
  const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

  it("開催中のイベントは400で削除しない", async () => {
    setupAdmin({ start_at: iso(-HOUR / 2), end_at: iso(HOUR / 2) });

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(400);
    expect(mocks.cancelEventBookings).not.toHaveBeenCalled();
  });

  it("終了済みのイベントは返金せずにDBから削除する", async () => {
    const from = setupAdmin({ start_at: iso(-3 * HOUR), end_at: iso(-2 * HOUR) });
    const deleteSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { delete: deleteSpy }));

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalled();
    expect(mocks.cancelEventBookings).not.toHaveBeenCalled();
  });

  it("これからのイベントは予約を中止・返金してから削除する", async () => {
    const from = setupAdmin({ start_at: iso(24 * HOUR), end_at: iso(25 * HOUR) });
    mocks.cancelEventBookings.mockResolvedValueOnce({ cancelled: 2, failedBookingIds: [] });
    const deleteSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { delete: deleteSpy }));

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.cancelEventBookings).toHaveBeenCalledWith("event-1");
    expect(json.cancelledBookings).toBe(2);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("返金に失敗した予約があればイベントを消さず非公開にして500を返す", async () => {
    const from = setupAdmin({ start_at: iso(24 * HOUR), end_at: null });
    mocks.cancelEventBookings.mockResolvedValueOnce({ cancelled: 2, failedBookingIds: ["b-1"] });
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();
    from.mockReturnValueOnce(chainable({ error: null }, { update: updateSpy, delete: deleteSpy }));

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.failedBookingIds).toEqual(["b-1"]);
    expect(updateSpy).toHaveBeenCalledWith({ status: "cancelled" });
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
