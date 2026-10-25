import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  checkRateLimit: vi.fn(),
  getSeatsLeft: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createServerClient }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit, RATE_LIMIT_MESSAGE: "多すぎます" }));
vi.mock("@/lib/waitlist", () => ({ getSeatsLeft: mocks.getSeatsLeft }));

const { POST, DELETE } = await import("./route");

const REQ = {} as NextRequest;
const params = { params: Promise.resolve({ id: "event-1" }) };
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function setup({
  user = { id: "user-1" } as { id: string } | null,
  event = { id: "event-1", start_at: FUTURE, status: "published" } as unknown,
  booking = null as unknown,
  left = 0,
} = {}) {
  mocks.createServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => chainable({ data: table === "events" ? event : booking, error: null })),
  });
  const upsertSpy = vi.fn();
  const deleteSpy = vi.fn();
  mocks.createServiceClient.mockReturnValue({
    from: vi.fn(() => chainable({ error: null }, { upsert: upsertSpy, delete: deleteSpy })),
  });
  mocks.getSeatsLeft.mockResolvedValue({ capacity: 10, booked: 10 - left, left });
  return { upsertSpy, deleteSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(true);
});

describe("POST /api/events/[id]/waitlist", () => {
  it("満席なら登録する", async () => {
    const { upsertSpy } = setup();
    const res = await POST(REQ, params);
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledWith({ event_id: "event-1", user_id: "user-1" }, expect.anything());
  });

  it("未ログインは401", async () => {
    setup({ user: null });
    expect((await POST(REQ, params)).status).toBe(401);
  });

  it("空きがあれば登録しない（そのまま予約できる）", async () => {
    const { upsertSpy } = setup({ left: 1 });
    const res = await POST(REQ, params);
    expect(res.status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("予約済みなら登録しない", async () => {
    const { upsertSpy } = setup({ booking: { id: "b1" } });
    expect((await POST(REQ, params)).status).toBe(400);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("見えないイベント・開始済みのイベントには登録しない", async () => {
    setup({ event: null });
    expect((await POST(REQ, params)).status).toBe(404);
    setup({ event: { id: "event-1", start_at: new Date(Date.now() - 1000).toISOString(), status: "published" } });
    expect((await POST(REQ, params)).status).toBe(400);
  });

  it("レート制限超過は429", async () => {
    setup();
    mocks.checkRateLimit.mockResolvedValue(false);
    expect((await POST(REQ, params)).status).toBe(429);
  });
});

describe("DELETE /api/events/[id]/waitlist", () => {
  it("本人のキャンセル待ちを取り消す", async () => {
    const { deleteSpy } = setup();
    const res = await DELETE(REQ, params);
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("未ログインは401", async () => {
    setup({ user: null });
    expect((await DELETE(REQ, params)).status).toBe(401);
  });
});
