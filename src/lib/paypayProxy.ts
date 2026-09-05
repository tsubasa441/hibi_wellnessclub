import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

// @paypayopa/paypayopa-sdk-node は内部で Node の https.request() を直接呼んでおり、
// カスタムエージェント（プロキシ）を渡す口を公開していない。PayPay の本番APIはIP
// 許可リスト制であり、Vercel のサーバーレス関数は既定では outbound の送信元IPが
// 固定されないため、PayPay SDK 呼び出しの瞬間だけ Node の https.globalAgent を
// 固定IPプロキシ（QuotaGuard Static 等）向けのエージェントに一時的に差し替える。
//
// PAYPAY_PROXY_URL が未設定の場合は何もせずそのまま実行する（ローカル開発・
// プロキシ未契約時は従来通りの直接通信になる）。
export async function withPayPayProxy<T>(fn: () => Promise<T>): Promise<T> {
  const proxyUrl = process.env.PAYPAY_PROXY_URL;
  if (!proxyUrl) return fn();

  const originalAgent = https.globalAgent;
  https.globalAgent = new HttpsProxyAgent(proxyUrl) as unknown as https.Agent;
  try {
    return await fn();
  } finally {
    https.globalAgent = originalAgent;
  }
}
