import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function Resend() {
    return { emails: { send: mocks.send } };
  }),
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: mocks.captureMessage,
  captureException: mocks.captureException,
}));

const { sendBookingConfirmation, sendCancellationNotification } = await import("./email");

const booking = {
  to: "user@example.com",
  userName: "山田 太郎",
  eventTitle: "Yoga",
  eventType: "yoga",
  description: "",
  startAt: "2026-11-10T07:00:00Z",
  location: "Fukuoka",
  price: 100,
  paymentMethod: "square" as const,
};

beforeEach(() => vi.clearAllMocks());

describe("email", () => {
  it("送信に成功したときは Sentry に記録しない", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    await sendBookingConfirmation(booking);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.com" }));
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it("Resend がエラーを返したら、例外を投げずに Sentry に記録する（宛先は記録しない）", async () => {
    mocks.send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "domain not verified" } });
    await expect(sendBookingConfirmation(booking)).resolves.toBeUndefined();
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Email send failed",
      expect.objectContaining({ tags: { area: "email", kind: "booking_confirmation" } })
    );
    expect(JSON.stringify(mocks.captureMessage.mock.calls[0])).not.toContain("user@example.com");
  });

  it("送信が例外を投げても、呼び出し元に例外を伝えない", async () => {
    mocks.send.mockRejectedValueOnce(new Error("network"));
    await expect(
      sendCancellationNotification({ to: "user@example.com", userName: "x", eventTitle: "Yoga", startAt: booking.startAt, price: 100, paymentMethod: "square", refunded: true })
    ).resolves.toBeUndefined();
    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { area: "email", kind: "cancellation" } });
  });
});
