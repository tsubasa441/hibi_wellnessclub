import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */

// Content-Security-Policy は、まず Report-Only（違反をブラウザのコンソールに出すのみで
// 実際のブロックはしない）で先行導入する。Square の決済用 iframe/SDK・Supabase への
// 通信・Sentry へのエラー送信を壊さないことを確認してから、
// Content-Security-Policy-Report-Only → Content-Security-Policy に切り替えて本適用する。
// 開発時のみ、Next.js の webpack HMR（eval-source-map）が eval() を使うため 'unsafe-eval' が
// 必要になる。本番ビルドでは付与しない（付与するとCSPの効果が大きく弱まるため）。
const isDev = process.env.NODE_ENV !== "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Next.js のインラインスクリプトや、既存コードに残るインライン style={{}} を当面許可する
  // （'unsafe-inline' はXSS対策としては弱いが、nonce導入は別途の作業とする）
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://web.squarecdn.com https://sandbox.web.squarecdn.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.squarecdn.com https://*.squareup.com https://*.sentry.io https://*.ingest.us.sentry.io",
  "frame-src https://web.squarecdn.com https://sandbox.web.squarecdn.com",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPSでない場合ブラウザは無視するため、開発環境（http）でも安全に設定できる
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_DIRECTIVES },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// SENTRY_AUTH_TOKEN が未設定の場合、ソースマップのアップロードはスキップされる
// （ビルド自体は失敗しない）。有効化する場合は Sentry のプロジェクト設定から発行する。
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: false,
  telemetry: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
