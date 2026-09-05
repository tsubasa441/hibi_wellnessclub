import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN が未設定の場合、SDKは何も送信しない（安全にno-opになる）。
// 本番で有効化するには Vercel の環境変数に SENTRY_DSN を設定する。
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // 個人情報を含みうるリクエストヘッダー・IPアドレス等をデフォルトで送信しない
  sendDefaultPii: false,
});
