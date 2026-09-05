import https from "https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withPayPayProxy } from "./paypayProxy";

describe("withPayPayProxy", () => {
  const originalAgent = https.globalAgent;
  const originalEnv = process.env.PAYPAY_PROXY_URL;

  afterEach(() => {
    https.globalAgent = originalAgent;
    if (originalEnv === undefined) {
      delete process.env.PAYPAY_PROXY_URL;
    } else {
      process.env.PAYPAY_PROXY_URL = originalEnv;
    }
  });

  it("PAYPAY_PROXY_URL未設定時は何もせずそのままfnを実行する", async () => {
    delete process.env.PAYPAY_PROXY_URL;
    const agentBefore = https.globalAgent;

    const result = await withPayPayProxy(async () => {
      expect(https.globalAgent).toBe(agentBefore);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(https.globalAgent).toBe(agentBefore);
  });

  it("PAYPAY_PROXY_URL設定時はfn実行中だけglobalAgentをプロキシに差し替え、実行後に元へ戻す", async () => {
    process.env.PAYPAY_PROXY_URL = "http://user:pass@proxy.example.com:8080";
    const agentBefore = https.globalAgent;
    let agentDuring: https.Agent | undefined;

    const result = await withPayPayProxy(async () => {
      agentDuring = https.globalAgent;
      return "ok";
    });

    expect(result).toBe("ok");
    expect(agentDuring).not.toBe(agentBefore);
    expect(https.globalAgent).toBe(agentBefore);
  });

  it("fnが例外を投げても、globalAgentは必ず元に戻る", async () => {
    process.env.PAYPAY_PROXY_URL = "http://user:pass@proxy.example.com:8080";
    const agentBefore = https.globalAgent;

    await expect(
      withPayPayProxy(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(https.globalAgent).toBe(agentBefore);
  });
});
