import * as Sentry from "@sentry/nextjs";

// DSN が未設定の場合、SDKは何も送信しない（安全にno-opになる）。
// DSN は非秘匿値（クライアントにも配信される）なので、SENTRY_DSN が無ければ
// NEXT_PUBLIC_SENTRY_DSN にフォールバックする（Vercel の変数を1つに統一できる）。
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // 個人情報を含みうるリクエストヘッダー・IPアドレス等をデフォルトで送信しない
  sendDefaultPii: false,
});
