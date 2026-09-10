import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "test-event-id"),
  flush: vi.fn(async () => true),
  getClient: vi.fn(() => ({
    getOptions: () => ({ dsn: "https://k@o1.ingest.us.sentry.io/1", environment: "test", release: "abc" }),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  flush: mocks.flush,
  getClient: mocks.getClient,
}));

const { GET } = await import("./route");

function makeRequest(params: Record<string, string> = {}): NextRequest {
  return {
    nextUrl: {
      searchParams: { get: (k: string) => params[k] ?? null },
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/debug/sentry", () => {
  it("token が一致しない場合は404（存在しない扱い）", async () => {
    const res = await GET(makeRequest({ token: "wrong" }));
    expect(res.status).toBe(404);
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("token が無い場合は404", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("CRON_SECRET 未設定なら404", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeRequest({ token: "test-secret" }));
    expect(res.status).toBe(404);
  });

  it("token 一致：Sentry にエラーを送信し診断結果を返す", async () => {
    const res = await GET(makeRequest({ token: "test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mocks.captureException).toHaveBeenCalledOnce();
    expect(mocks.flush).toHaveBeenCalled();
    expect(body.sentry).toMatchObject({
      dsnConfigured: true,
      eventId: "test-event-id",
      flushed: true,
    });
  });

  it("?throw=1：捕捉されない例外を投げる", async () => {
    await expect(GET(makeRequest({ token: "test-secret", throw: "1" }))).rejects.toThrow(
      /Sentry connectivity test \(uncaught\)/
    );
  });
});
