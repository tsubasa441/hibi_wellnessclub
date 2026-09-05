import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_SENTRY_DSN が未設定の場合、SDKは何も送信しない（安全にno-opになる）。
// 本番で有効化するには Vercel の環境変数に NEXT_PUBLIC_SENTRY_DSN を設定する。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

// App Router のページ遷移をSentryのナビゲーション計測に接続する
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
