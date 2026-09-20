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

## PayPay 本番化の手順・注意点

### 事前に必要なもの
- PayPay の**本番用**の API Key・API Secret・Merchant ID（サンドボックス用とは別物）。
- PayPay 側の IP 許可リストに、固定 IP プロキシ（QuotaGuard Static）の静的 IP を**すべて**登録し、承認済みであること。
- 固定 IP プロキシの接続 URL（`http://<ユーザー名>:<パスワード>@<ホスト>:<ポート>`）。QuotaGuard ダッシュボードの Connection Information からコピーする。

### Vercel の環境変数
| 変数 | 値 | 区分 |
|------|----|------|
| `PAYPAY_PRODUCTION` | `true` | 通常 |
| `PAYPAY_CLIENT_ID` | 本番の API Key | Sensitive 推奨 |
| `PAYPAY_CLIENT_SECRET` | 本番の API Secret | Sensitive |
| `PAYPAY_MERCHANT_ID` | 本番の Merchant ID | どちらでも可 |
| `PAYPAY_PROXY_URL` | プロキシの接続 URL（パスワードを含む） | Sensitive |

- **必ず Production 環境に設定する**。Development / Preview のみに入っていると、本番では未設定・古い値のまま動く（実際に発生し、`QRCodeCreate` が `codeId 08100016` で失敗した）。
- 変更後は再デプロイが必要。Deployments で最新のデプロイが Ready になり、Production のバッジが付いたことを確認してから試す。
- `NEXT_PUBLIC_SITE_URL` は末尾スラッシュなしの本番 URL（決済後のコールバック URL に使われる）。

### 障害の調べ方
- Sentry の「PayPay QRCodeCreate failed」に、PayPay の応答（`resultInfo`）が記録される。Sentry は `code`・`message` というキー名をマスクするため、`codeId` を見る。
- 「PayPay reconcile: payment not completed」に、未完了だった予約の照会結果（`status`・`codeId`・経過時間）が記録される。

### 実装上の注意（PayPay SDK）
- QR コード決済の状況照会は `GetCodePaymentDetails`（`/v2/codes/payments/…`）。`GetPaymentDetails` は別方式用で、QR 決済では支払い済みでも完了と判定できない。
- 返金は `PaymentRefund` にオブジェクト（`merchantRefundId`・`paymentId`・`amount`・`reason`）を渡す。`paymentId` は PayPay 側の ID で、Hibi が `bookings.payment_id` に保存している加盟店側の ID（＝予約 ID）とは別。返金前に照会して取得する。結果コードが `SUCCESS` でなければ失敗として扱う。
- 支払い後にユーザーがサイトへ戻らないことがあるため、予約の確定はコールバックと、`/bookings`・`/events/[id]` ロード時の照会（`src/lib/paypayReconcile.ts`）の両方で行う（`docs/architecture.md` の決済フロー参照）。

### 本番 E2E の手順（実課金あり）
1. 管理画面で、¥100・開催日が 3 日以上先のテストイベントを作成する（キャンセル時の返金は 2 日前までが対象）。
2. PayPay で予約して支払いを完了する。
3. 予約が確定すること（サイトへ戻った場合と、戻らず `/bookings` を開いた場合の両方）、確認メールが届くこと、参加者一覧が「支払済み」になることを確認する。
4. `/bookings` からキャンセルし、PayPay 側に返金されること、参加者一覧が「返金済み」になることを確認する。
5. テストイベントを論理削除する。

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
- [ ] PayPay の本番 E2E（予約確定・確認メール・キャンセル返金）確認済み（`docs/testplan.md` 4-6）
- [ ] `NEXT_PUBLIC_SITE_URL` が本番 URL に設定済み
- [ ] E2E テスト・手動テスト完了
- [ ] カスタムドメイン設定（任意）

---

## ロールバック手順

Vercel ダッシュボードから前のデプロイに即時ロールバック可能。

```
Vercel Dashboard → Deployments → 対象デプロイ → Promote to Production
```
