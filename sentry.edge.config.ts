import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN が未設定の場合、SDKは何も送信しない（安全にno-opになる）。
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
