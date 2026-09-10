import * as Sentry from "@sentry/nextjs";

// SENTRY_DSN 未設定なら NEXT_PUBLIC_SENTRY_DSN にフォールバック（server config と同様）。
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
