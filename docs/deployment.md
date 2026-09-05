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
```

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
