import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { GET } = await import("./route");

function makeRequest(token?: string): NextRequest {
  return {
    nextUrl: {
      searchParams: {
        get: (k: string) => (k === "token" ? token ?? null : null),
      },
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/debug/sentry", () => {
  it("token が一致しない場合は404（存在しない扱い）", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(404);
  });

  it("token が無い場合は404", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("CRON_SECRET 未設定なら token 有無に関わらず404", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(404);
  });

  it("token が一致する場合は意図的にエラーを投げる（Sentry疎通確認）", async () => {
    await expect(GET(makeRequest("test-secret"))).rejects.toThrow(
      /Sentry connectivity test/
    );
  });
});
