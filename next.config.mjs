import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */

// Content-Security-Policy は Report-Only（違反をブラウザのコンソールと report-uri に
// 送るだけで実際のブロックはしない）で先行導入している。Square の決済用 iframe/SDK・
// Supabase への通信・Sentry へのエラー送信を壊さないことを確認してから本適用に切り替える。
//
// 本適用への切り替えは環境変数で行う（next.config の headers() はビルド時に評価される
// ため、Vercel で環境変数を変更したあと再デプロイが必要。ロールバックは環境変数を戻して
// 再デプロイ、または Vercel の Instant Rollback で直前のデプロイに戻す）：
//   CSP_REPORT_ONLY=false  → Content-Security-Policy（本適用・ブロックあり）
//   未設定 / それ以外       → Content-Security-Policy-Report-Only（既定）
//
// NEXT_PUBLIC_SENTRY_DSN（または SENTRY_DSN）が設定されている場合、その DSN から
// Sentry の CSP レポート受信エンドポイントを組み立てて report-uri に付与する。これにより
// Report-Only 期間中の違反が Sentry に集約され、本適用の可否を実データで判断できる。
//
// 開発時のみ、Next.js の webpack HMR（eval-source-map）が eval() を使うため 'unsafe-eval'
// が必要。本番ビルドでは付与しない（付与すると CSP の効果が大きく弱まるため）。
const isDev = process.env.NODE_ENV !== "production";
const cspReportOnly = process.env.CSP_REPORT_ONLY !== "false";

function cspReportUri() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/\//g, "");
    if (!projectId || !u.username) return null;
    return `${u.protocol}//${u.host}/api/${projectId}/security/?sentry_key=${u.username}`;
  } catch {
    return null;
  }
}

const reportUri = cspReportUri();

// Square Web Payments SDK が必要とするドメイン（本番）。
// 参照: https://developer.squareup.com/docs/web-payments/content-security-policy
// sandbox.web.squarecdn.com はプレビュー環境での sandbox 決済確認のために残している。
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Next.js のインラインスクリプトや、既存コードに残るインライン style={{}} を当面許可する
  // （'unsafe-inline' はXSS対策としては弱いが、nonce導入は別途の作業とする）
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://web.squarecdn.com https://sandbox.web.squarecdn.com`,
  // Square が top-level ドキュメントに直接スタイルを挿入する（2026-09-12 本番決済で
  // style-src-elem 違反として web.squarecdn.com を検出）。
  "style-src 'self' 'unsafe-inline' https://*.squarecdn.com",
  "img-src 'self' data: blob: https://*.squarecdn.com",
  // square-fonts-production-f.squarecdn.com・cash-f.squarecdn.com 等、squarecdn.com 配下の
  // フォントサブドメインは個別列挙すると漏れる（2026-09-12 本番決済で cash-f.squarecdn.com の
  // font-src 違反を検出済み）。ワイルドカードでまとめて許可する。CloudFront の
  // d1g145x70srn7h.cloudfront.net は squarecdn.com 配下ではないため個別に残す。
  "font-src 'self' data: https://*.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.squarecdn.com https://*.squareup.com https://*.sentry.io https://*.ingest.us.sentry.io",
  // 3-Dセキュア（本人認証）の認証画面は、使用するカードの発行会社・提携する認証会社
  // （例: acs-jcn.dnp-cdms.jp）によってドメインが変わり、事前に列挙できない
  // （2026-09-12 本番決済で frame-src・form-action の両方で検出。Square 公式 CSP
  // ガイドも3Dセキュアの要件には触れていない）。frame-ancestors 'none' により
  // 「Hibi を他サイトへ埋め込む」方向は引き続き完全ブロックしたまま、
  // 「Hibi が埋め込む／フォーム送信する」方向のみ HTTPS 全体を許可する。
  "frame-src 'self' https:",
  "form-action 'self' https:",
  ...(reportUri ? [`report-uri ${reportUri}`] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPSでない場合ブラウザは無視するため、開発環境（http）でも安全に設定できる
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: cspReportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    value: CSP_DIRECTIVES,
  },
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
