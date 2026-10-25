import { beforeEach, describe, expect, it, vi } from "vitest";
import { chainable } from "@/lib/testUtils/supabaseMock";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  sendWaitlistSeatAvailable: vi.fn(),
  getUserById: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/lib/email", () => ({ sendWaitlistSeatAvailable: mocks.sendWaitlistSeatAvailable }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

const { notifyWaitlistIfSeatsOpen } = await import("./waitlist");

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function setup({
  event = { id: "event-1", title: "Yoga", start_at: FUTURE, status: "published", capacity: 2 },
  booked = 1,
  entries = [{ user_id: "u1" }, { user_id: "u2" }],
  emails = { u1: "a@example.com", u2: "b@example.com" } as Record<string, string>,
} = {}) {
  const deleteSpy = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "events") return chainable({ data: event, error: null });
    if (table === "bookings") return chainable({ data: null, count: booked, error: null });
    if (table === "event_waitlist") return chainable({ data: entries, error: null }, { delete: deleteSpy });
    return chainable({ data: { nickname: "テスト" }, error: null });
  });
  mocks.getUserById.mockImplementation(async (id: string) => ({ data: { user: { email: emails[id] } } }));
  mocks.createServiceClient.mockReturnValue({ from, auth: { admin: { getUserById: mocks.getUserById } } });
  return { deleteSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyWaitlistIfSeatsOpen", () => {
  it("空きがあれば、キャンセル待ちの全員にメールを送り、キャンセル待ちを消す", async () => {
    const { deleteSpy } = setup();
    const sent = await notifyWaitlistIfSeatsOpen("event-1");
    expect(sent).toBe(2);
    expect(deleteSpy).toHaveBeenCalled();
    expect(mocks.sendWaitlistSeatAvailable).toHaveBeenCalledTimes(2);
    expect(mocks.sendWaitlistSeatAvailable).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.com", eventId: "event-1" }));
  });

  it("満席のままなら何もしない", async () => {
    const { deleteSpy } = setup({ booked: 2 });
    expect(await notifyWaitlistIfSeatsOpen("event-1")).toBe(0);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mocks.sendWaitlistSeatAvailable).not.toHaveBeenCalled();
  });

  it("開始済み・非公開のイベントには送らない", async () => {
    setup({ event: { id: "event-1", title: "Yoga", start_at: new Date(Date.now() - 1000).toISOString(), status: "published", capacity: 2 } });
    expect(await notifyWaitlistIfSeatsOpen("event-1")).toBe(0);
    setup({ event: { id: "event-1", title: "Yoga", start_at: FUTURE, status: "cancelled", capacity: 2 } });
    expect(await notifyWaitlistIfSeatsOpen("event-1")).toBe(0);
    expect(mocks.sendWaitlistSeatAvailable).not.toHaveBeenCalled();
  });

  it("退会済みのアドレスには送らない", async () => {
    setup({ emails: { u1: "deleted-u1@deleted.invalid", u2: "b@example.com" } });
    expect(await notifyWaitlistIfSeatsOpen("event-1")).toBe(1);
    expect(mocks.sendWaitlistSeatAvailable).toHaveBeenCalledWith(expect.objectContaining({ to: "b@example.com" }));
  });

  it("途中で失敗しても例外を投げない", async () => {
    mocks.createServiceClient.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(await notifyWaitlistIfSeatsOpen("event-1")).toBe(0);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
