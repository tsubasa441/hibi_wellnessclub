# Hibi アーキテクチャ設計

---

## システム構成

```
ブラウザ
  └── Next.js 14（App Router）/ Vercel
        ├── Server Components（データ取得・ページ描画）
        ├── Client Components（インタラクション）
        └── API Routes（決済処理）
              └── Supabase（PostgreSQL + Auth + Storage）
```

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|----------|
| フレームワーク | Next.js（App Router） | 14 |
| 言語 | TypeScript | 5 |
| スタイリング | Tailwind CSS | v4 |
| データベース | Supabase（PostgreSQL） | - |
| 認証 | Supabase Auth | - |
| 決済 | Square API / PayPay API | - |
| ホスティング | Vercel | - |
| フォント | Outfit / Cormorant Garamond / DM Sans | Google Fonts |
| エラー監視 | Sentry（`@sentry/nextjs`） | - |

セキュリティ関連の実装方針：
- **レート制限**: `src/lib/rateLimit.ts` の `checkRateLimit()` が Supabase の `check_rate_limit` RPC（`rate_limits`テーブル、service_role専用）を使い、決済・ジャーナル・サインアップ・チェックイン・キャンセル・アカウント削除等の主要APIをユーザーID（未認証のconvert-nameのみIPアドレス）単位で制限する
- **セキュリティヘッダー / CSP**: `next.config.mjs` の `headers()` で全ルートに `X-Frame-Options`・`X-Content-Type-Options`・`Referrer-Policy`・`Permissions-Policy`・`Strict-Transport-Security` を付与。`Content-Security-Policy` はまず `Content-Security-Policy-Report-Only` として段階導入し、Square決済iframe等を壊さないことを確認してから本適用に切り替える運用
- **エラー監視**: `@sentry/nextjs` を導入（`sentry.server.config.ts`・`sentry.edge.config.ts`・`src/instrumentation.ts`・`src/instrumentation-client.ts`・`src/app/global-error.tsx`）。`SENTRY_DSN`・`NEXT_PUBLIC_SENTRY_DSN` が未設定の場合はSDKが何もしない安全なno-op状態になる
- **アカウント削除**: `/impact` の「アカウントを削除する」→ `POST /api/account/delete`。個人情報のみ匿名化し、予約・決済・ポイント等の履歴データは保持する（@docs/authdesign.md参照）

---

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト・フォント設定
│   ├── globals.css             # カラー変数・グローバルスタイル・.app-bg
│   ├── page.tsx                # トップページ（/）
│   ├── login/
│   │   ├── page.tsx            # 認証チェック（認証済みなら /home へリダイレクト）
│   │   └── LoginForm.tsx       # ログイン・新規登録フォーム（タブ切り替え・紹介コード対応）
│   ├── register-complete/page.tsx  # 新規登録完了画面
│   ├── home/page.tsx           # ホーム（ログイン後ランディング）
│   ├── events/
│   │   ├── page.tsx            # イベント一覧
│   │   └── [id]/
│   │       ├── page.tsx        # イベント詳細
│   │       ├── BookingButton.tsx
│   │       ├── EventOptionFields.tsx  # 選択項目の入力UI（単一=select / 複数=チェックボックスパネル）
│   │       └── checkout/
│   │           ├── page.tsx
│   │           └── CheckoutForm.tsx
│   ├── bookings/
│   │   ├── page.tsx            # 予約済みイベント一覧・キャンセル・チェックイン
│   │   └── CheckInButton.tsx   # チェックインボタン（開始〜終了時刻のみ活性。Client Component）
│   ├── auth/
│   │   ├── confirm/route.ts         # 再設定メールのリンク先。token_hash を verifyOtp して /auth/reset-password へ
│   │   └── reset-password/page.tsx  # パスワード再設定（confirm 経由でリカバリーセッション確立後に表示）
│   ├── legal/
│   │   ├── tokushoho/page.tsx   # 特定商取引法に基づく表記（認証不要・静的コンテンツ）
│   │   └── privacy/page.tsx     # プライバシーポリシー（認証不要・静的コンテンツ）
│   ├── impact/
│   │   ├── page.tsx            # Impact（プロフィール・参加履歴・バッジ・紹介）
│   │   ├── ReferralShare.tsx   # 紹介リンクシェアボタン（Client Component）
│   │   └── DeleteAccountButton.tsx  # アカウント削除ボタン（確認ダイアログ→POST /api/account/delete）
│   ├── admin/                   # 管理者向け画面（is_admin のみアクセス可、layout.tsxでガード）
│   │   ├── layout.tsx            # 認証・管理者判定・AdminNav表示
│   │   ├── AdminNav.tsx          # 管理画面用ナビ（Client Component）
│   │   ├── page.tsx              # /admin/events へ redirect
│   │   └── events/
│   │       ├── page.tsx          # イベント一覧（削除済みは除く）
│   │       ├── EventForm.tsx     # 作成/編集共通フォーム（Client Component）
│   │       ├── new/page.tsx      # イベント新規作成
│   │       └── [id]/
│   │           ├── page.tsx             # イベント編集
│   │           ├── DeleteEventButton.tsx  # 論理削除ボタン（Client Component）
│   │           └── participants/page.tsx  # 参加者一覧・CSVダウンロード導線
│   ├── global-error.tsx         # ルートのエラーバウンダリ（Sentryへ送信）
│   └── api/
│       ├── account/delete/route.ts        # アカウント削除（個人情報の匿名化・auth.users無効化）
│       ├── bookings/[id]/cancel/route.ts   # 予約キャンセル・返金処理
│       ├── bookings/[id]/checkin/route.ts  # イベントチェックイン（時間ゲート・service_role更新）
│       ├── convert-name/route.ts          # 名前ローマ字変換（未認証・IPアドレスでレート制限）
│       ├── cron/badges/route.ts           # バッジ付与 Cron（Vercel）
│       ├── journals/route.ts              # ジャーナル記録
│       ├── payments/
│       │   ├── square/route.ts
│       │   └── paypay/
│       │       ├── route.ts
│       │       └── callback/route.ts
│       ├── signup/profile/route.ts        # サインアップ時プロフィール作成
│       └── admin/events/
│           ├── route.ts                    # POST イベント作成
│           └── [id]/
│               ├── route.ts                # PATCH 更新 / DELETE 論理削除
│               └── participants/export/route.ts  # GET 参加者CSVエクスポート
├── components/
│   ├── Header.tsx              # 共通ヘッダー（Hibi テキスト + ログアウト）
│   ├── BottomNav.tsx           # 共通フッターナビ（Home / Event / Impact）
│   └── Footer.tsx              # 特定商取引法表記・プライバシーポリシーへのリンク（トップ・ログイン・登録完了ページに設置）
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # ブラウザ用クライアント
│   │   ├── server.ts           # サーバー用クライアント
│   │   └── service.ts          # service_role クライアント（RLSバイパス、Cron・管理者APIの一部で使用）
│   ├── admin.ts                # 管理者判定（isAdmin）
│   ├── badges.ts               # バッジ付与ロジック
│   ├── csv.ts                  # CSV生成ヘルパー
│   ├── date.ts                 # JST基準の日付・時刻ヘルパー（サーバーの実行タイムゾーンに依存しないための共通処理）
│   ├── email.ts                # メール送信（Resend）
│   ├── encrypt.ts              # 名前の暗号化・復号
│   ├── eventValidation.ts      # イベント入力バリデーション（管理者API用）・選択項目の検証とスナップショット組み立て
│   ├── points.ts               # ポイント付与・取り消しロジック
│   ├── ranks.ts                # ランク定義・ランクアップ判定
│   ├── rateLimit.ts            # APIレート制限（Supabaseのcheck_rate_limit RPC経由）
│   └── toRomaji.ts             # 日本語→ローマ字変換（kuroshiro）
├── instrumentation.ts          # Sentry初期化フック（サーバー/Edge、Next.js標準の起動フック）
└── instrumentation-client.ts   # Sentry初期化（ブラウザ側）
sentry.server.config.ts         # Sentry初期化設定（Node.jsランタイム）
sentry.edge.config.ts           # Sentry初期化設定（Edgeランタイム）
public/
└── images/
    └── top.png                 # トップ・ログイン背景画像
docs/                           # ドキュメント一式
```

---

## 画面遷移

```
/ トップページ
  └─[ボタンタップ]→ /login ログイン・新規登録（SIGN IN / SIGN UP タブ）
                      └─[認証成功]→ /home ホーム
                                      ├─[「すべて見る」]→ /bookings 予約済みイベント一覧（キャンセル）
                                      ├─[BottomNav: Event]→ /events イベント一覧
                                      │                         └─[タップ]→ /events/[id] 詳細
                                      │                                         └─[予約]→ /events/[id]/checkout 決済
                                      └─[BottomNav: Impact]→ /impact
                                                                （プロフィール・参加履歴・バッジ・紹介コード・シェア）

/login?ref=コード  ←── /impact の紹介リンク経由（SIGN UP タブが自動選択される）

/login「パスワードを忘れた」→ リセットメール送信 → /auth/reset-password（メールのリンクから遷移・新パスワード設定）→ /home
```

管理者（`profiles.is_admin = true`）は `/admin/events` から独立してイベント管理・参加者管理を行う。一般ユーザー導線とは接続しない（URLを直接開く運用）。管理者以外が `/admin/*` にアクセスした場合は `/home` へリダイレクトする。

`/`・`/login`・`/register-complete` の下部に共通 `Footer`（`src/components/Footer.tsx`）を設置し、`/legal/tokushoho`（特定商取引法に基づく表記）・`/legal/privacy`（プライバシーポリシー）へ遷移できる。この2画面は認証不要。

### BottomNav 構成（全認証済み画面共通）

| タブ | アイコン | リンク先 |
|------|---------|---------|
| Home | 家アイコン | `/home` |
| Event | カレンダーアイコン | `/events` |
| Impact | ハートアイコン | `/impact` |

---

## データフロー

### ページ描画（Server Components）
```
リクエスト → Next.js Server Component → Supabase（server.ts）→ HTML 返却
```

### インタラクション（Client Components）
```
ユーザー操作 → Client Component → Supabase（client.ts）or API Route → UI 更新
```

### 決済フロー
```
ユーザー → CheckoutForm → POST /api/payments/square or paypay
  → 外部決済 API → 成功時 bookings テーブルに insert → /events/[id]?booked=1 へリダイレクト
```

---

## Supabase 利用方針

| 用途 | 使用するクライアント |
|------|-------------------|
| Server Components・API Routes | `src/lib/supabase/server.ts` |
| Client Components | `src/lib/supabase/client.ts` |

- RLS（Row Level Security）を全テーブルに適用する
- 直接 SQL は書かず、Supabase クライアント経由でアクセスする
