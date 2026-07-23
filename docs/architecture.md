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

---

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト・フォント設定
│   ├── globals.css             # カラー変数・グローバルスタイル・.app-bg
│   ├── page.tsx                # トップページ（/）
│   ├── login/page.tsx          # ログイン・新規登録（タブ切り替え・紹介コード対応）
│   ├── register-complete/page.tsx  # 新規登録完了画面
│   ├── home/page.tsx           # ホーム（ログイン後ランディング）
│   ├── events/
│   │   ├── page.tsx            # イベント一覧
│   │   └── [id]/
│   │       ├── page.tsx        # イベント詳細
│   │       ├── BookingButton.tsx
│   │       └── checkout/
│   │           ├── page.tsx
│   │           └── CheckoutForm.tsx
│   ├── impact/
│   │   ├── page.tsx            # Impact（プロフィール・参加履歴・バッジ・紹介）
│   │   └── ReferralShare.tsx   # 紹介リンクシェアボタン（Client Component）
│   └── api/
│       ├── bookings/[id]/cancel/route.ts  # 予約キャンセル・返金処理
│       ├── convert-name/route.ts          # 名前ローマ字変換
│       ├── cron/badges/route.ts           # バッジ付与 Cron（Vercel）
│       ├── journals/route.ts              # ジャーナル記録
│       ├── payments/
│       │   ├── square/route.ts
│       │   └── paypay/
│       │       ├── route.ts
│       │       └── callback/route.ts
│       └── signup/profile/route.ts        # サインアップ時プロフィール作成
├── components/
│   ├── Header.tsx              # 共通ヘッダー（Hibi テキスト + ログアウト）
│   └── BottomNav.tsx           # 共通フッターナビ（Home / Event / Impact）
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # ブラウザ用クライアント
│   │   └── server.ts           # サーバー用クライアント
│   ├── badges.ts               # バッジ付与ロジック
│   ├── email.ts                # メール送信（Resend）
│   ├── encrypt.ts              # 名前の暗号化・復号
│   ├── points.ts               # ポイント付与・取り消しロジック
│   ├── ranks.ts                # ランク定義・ランクアップ判定
│   └── toRomaji.ts             # 日本語→ローマ字変換（kuroshiro）
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
                                      ├─[BottomNav: Event]→ /events イベント一覧
                                      │                         └─[タップ]→ /events/[id] 詳細
                                      │                                         └─[予約]→ /events/[id]/checkout 決済
                                      └─[BottomNav: Impact]→ /impact
                                                                （プロフィール・参加履歴・バッジ・紹介コード・シェア）

/login?ref=コード  ←── /impact の紹介リンク経由（SIGN UP タブが自動選択される）
```

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
