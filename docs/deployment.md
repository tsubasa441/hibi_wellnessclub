# Hibi デプロイ手順

---

## インフラ構成

| サービス | 用途 |
|---------|------|
| Vercel | Next.js ホスティング（GitHub 連携・自動デプロイ） |
| Supabase | データベース・認証（本番プロジェクト） |
| Square | 本番決済 |
| PayPay | 本番決済 |

---

## 環境変数

`.env.local`（ローカル）/ Vercel の環境変数に設定する。

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Square
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_ENVIRONMENT=production
NEXT_PUBLIC_SQUARE_APP_ID=
NEXT_PUBLIC_SQUARE_ENVIRONMENT=production

# PayPay
PAYPAY_CLIENT_ID=
PAYPAY_CLIENT_SECRET=
PAYPAY_MERCHANT_ID=
PAYPAY_PRODUCTION=true
# PayPay本番APIはIP許可リスト制だが、Vercelのサーバーレス関数は既定でoutboundの送信元IPが
# 固定されないため、固定IPプロキシ（QuotaGuard Static等）経由でPayPay SDK呼び出しのみを
# ルーティングする（src/lib/paypayProxy.ts）。未設定時は従来通りプロキシなしで直接通信する。
PAYPAY_PROXY_URL=

# メール送信（Resend）
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Vercel Cron 保護用シークレット（openssl rand -hex 32 で生成）
CRON_SECRET=

# 個人情報暗号化キー（AES-256-GCM、openssl rand -hex 32 で生成）
ENCRYPTION_KEY=

# サイトURL
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# エラー監視（Sentry）。未設定なら SDK は no-op。
# NEXT_PUBLIC_SENTRY_DSN を設定すると、サーバー側もこれにフォールバックし、
# その DSN から CSP レポート送信先も自動で組み立てる。SENTRY_DSN は明示用（任意）。
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# Content-Security-Policy の適用モード。未設定=Report-Only（既定）、"false"=本適用。
# next.config.mjs の headers() はビルド時評価のため、変更後は再デプロイが必要。
CSP_REPORT_ONLY=
```

---

## Sentry（エラー監視）の有効化手順

1. [sentry.io](https://sentry.io) でプロジェクトを作成（Platform: **Next.js**）。作成後に表示される DSN
   （`https://<key>@o<org>.ingest.us.sentry.io/<project>`）を控える。
2. Vercel の環境変数（Production / Preview）に設定：
   - `NEXT_PUBLIC_SENTRY_DSN` … DSN。サーバー側 config もこれにフォールバックするので
     基本これ1つでよい（`SENTRY_DSN` は明示したい場合のみ、同じ値を追加）
   - （任意）`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` … ソースマップアップロード用
3. 再デプロイ（`NEXT_PUBLIC_*` はビルド時に埋め込まれるため env 追加だけでは反映されない）。
4. 疎通確認（サーバー側）：`GET /api/debug/sentry?token=<CRON_SECRET>` が
   `{"sentry":{"dsnConfigured":true,"eventId":"...","flushed":true}}` を返し、
   数十秒後に Sentry の Issues に
   「Sentry connectivity test: intentional error from GET /api/debug/sentry」が出れば OK。
   `dsnConfigured:false` ならサーバーに DSN が渡っていない。
   トークンなし／不一致では 404 を返す（一般には存在しないエンドポイント）。
   `?throw=1` を付けると捕捉されない例外を投げ、フレームワーク経由の捕捉も試せる。
5. クライアント側は、本番でわざと JS エラーを起こす（存在しないページ操作等）か、
   `src/app/global-error.tsx` に到達する状況を作ると Issues に記録される。

## CSP を本適用に切り替える手順（14-5）

Report-Only 期間に Sentry の CSP レポート（Security カテゴリ）へ違反が集約される。
Square 実カード決済（3-D セキュア含む）を含めて違反ゼロを確認してから：

1. Vercel の環境変数（Production）に `CSP_REPORT_ONLY=false` を追加。
2. 再デプロイ（headers() はビルド時評価のため必須）。
3. レスポンスヘッダーが `Content-Security-Policy`（`-Report-Only` なし）に変わったことを確認。
4. 決済フローを一通り再確認。問題があれば環境変数を削除して再デプロイ、または
   Vercel Dashboard の Instant Rollback で直前のデプロイへ即時復帰。

---

## デプロイフロー

### 開発 → 本番

```
1. main ブランチにマージ
2. Vercel が自動でビルド・デプロイ
3. ビルドエラーがないか確認
4. 本番 URL でスモークテスト実施
```

### 手動デプロイ（必要な場合）

```bash
# Vercel CLI
vercel --prod
```

---

## Supabase 本番切り替え手順

1. Supabase で本番プロジェクトを作成
2. `supabase/migrations/` のマイグレーションを本番に適用
3. RLS ポリシーが正しく設定されているか確認
4. 本番の URL・Anon Key を Vercel 環境変数に設定

---

## リリースチェックリスト

- [ ] 環境変数がすべて Vercel に設定済み
- [ ] Supabase 本番 DB にマイグレーション適用済み
- [ ] Square / PayPay を本番キーに切り替え済み
- [ ] `NEXT_PUBLIC_SITE_URL` が本番 URL に設定済み
- [ ] E2E テスト・手動テスト完了
- [ ] カスタムドメイン設定（任意）

---

## ロールバック手順

Vercel ダッシュボードから前のデプロイに即時ロールバック可能。

```
Vercel Dashboard → Deployments → 対象デプロイ → Promote to Production
```
