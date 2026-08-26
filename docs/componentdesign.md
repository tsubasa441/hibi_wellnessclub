# Hibi コンポーネント設計

---

## 方針

- 共通コンポーネントは `src/components/` に配置する
- ページ固有のコンポーネントはそのページのディレクトリに配置する
- Server Component を基本とし、インタラクションが必要な場合のみ `"use client"` を使う

---

## 共通コンポーネント一覧

| コンポーネント | パス | 説明 |
|-------------|------|------|
| Header | `src/components/Header.tsx` | ロゴ・ログアウトボタン |
| BottomNav | `src/components/BottomNav.tsx` | 下部ナビゲーション（Home / Event / Impact） |
| RankIcon | `src/components/RankIcon.tsx` | ランクアイコン表示 |

ボタン・カードは共通コンポーネント化せず、下記バリエーションのユーティリティクラスをその都度使用する。

---

## ページ固有コンポーネント

| コンポーネント | パス | 説明 | Client? |
|-------------|------|------|---------|
| LoginForm | `app/login/LoginForm.tsx` | ログイン・新規登録・パスワード再設定リクエストフォーム | ✅ |
| BookingButton | `app/events/[id]/BookingButton.tsx` | 予約・決済ボタン | ✅ |
| CheckoutForm | `app/events/[id]/checkout/CheckoutForm.tsx` | 決済フォーム | ✅ |
| ReferralShare | `app/impact/ReferralShare.tsx` | URLコピー・シェアボタン | ✅ |
| AdminNav | `app/admin/AdminNav.tsx` | 管理画面用ナビ（ログアウト・ユーザー画面への導線） | ✅ |
| EventForm | `app/admin/events/EventForm.tsx` | イベント作成/編集共通フォーム | ✅ |
| DeleteEventButton | `app/admin/events/[id]/DeleteEventButton.tsx` | イベント論理削除の確認ダイアログ | ✅ |

---

## コンポーネント設計ルール

### Server Component（デフォルト）
- データ取得は Server Component で行う
- `supabase/server.ts` を使う
- `async/await` で直接データフェッチ

### Client Component
- `"use client"` を先頭に記載
- `useState`・`useEffect`・イベントハンドラが必要な場合のみ使用
- `supabase/client.ts` を使う

---

## ボタンのバリエーション

```tsx
// プライマリ
<button className="bg-sage-500 text-white font-outfit font-medium px-8 py-3 rounded-full hover:bg-sage-600 transition">
  ラベル
</button>

// セカンダリ
<button className="border border-ink-500 text-ink-500 font-outfit font-medium px-8 py-3 rounded-full hover:bg-sage-100 transition">
  ラベル
</button>

// 無効
<button disabled className="bg-base-200 text-ink-300 font-outfit font-medium px-8 py-3 rounded-full cursor-not-allowed">
  ラベル
</button>
```

---

## カードのバリエーション

```tsx
// 標準カード
<div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(44,53,49,0.08)] hover:shadow-[0_4px_12px_rgba(44,53,49,0.12)] transition">
  ...
</div>

// アクセントカード（予約済み・選択中）
<div className="bg-sage-100 border border-sage-200 rounded-2xl p-5">
  ...
</div>
```

---

## トップページ（`/`）

### レイアウト構成

| エリア | 内容 |
|--------|------|
| 背景 | `public/images/top.png`（全画面・固定・黒オーバーレイ bg-black/20） |
| 中央上部 | 「Hibi」テキスト（font-outfit / text-5xl / white） |
| Hibi直下 | 「Wellness Club」（font-cormorant / text-xs / white/90 / tracking-[0.3em]） |
| 中央 | コンセプトコピー2行 |
| 下部 | 「イベントご参加の方はこちら」ボタン → `/login` へ遷移 |

### 表示内容

- **Hibi**: テキストで表示（画像ロゴは使用しない）
- **Wellness Club**: Hibi直下にサブテキストとして表示
- **コンセプトコピー1行目**: 「大人になった今でも心躍る毎日を」（font-dm / text-sm / white）
- **コンセプトコピー2行目**: 「福岡と東京を拠点としたウェルネスコミュニティ。〜見つけるきっかけに。」（font-cormorant / text-[10px] / white/80）
- **ボタン**: 「イベントご参加の方はこちら」（bg-white/90 / text-brown-600 / rounded-full）→ `/login` へ遷移

---

## ログイン・新規登録ページ（`/login`）

### レイアウト構成

| エリア | 内容 |
|--------|------|
| 背景 | `app-bg`（ニューモーフィズム・写真背景なし） |
| カード | `nm-card`（浮き出しカード）でフォーム全体を囲む |
| 上部中央 | 「Hibi」テキスト（font-outfit / text-3xl / text-ink-700） |
| タブ | 「ログイン」「新規登録」切り替え（`nm-inset` トラック内のピル、アクティブ時 `nm-btn-primary`） |
| フォーム | 凹み入力欄（`nm-inset` / rounded） |
| ボタン | 「ログイン」または「SIGN UP」（`nm-btn-primary` / text-white） |

### 仕様

- SIGN IN / SIGN UP を1ページ内でタブ切り替え（`useState` で制御）
- SIGN IN フォーム: EMAIL・PASSWORD
- SIGN UP フォーム: NAME・NICKNAME・EMAIL・PASSWORD
- タブ切り替え時にフォームをリセット
- SIGN IN 成功後 `/home` へ、SIGN UP 成功後 `/register-complete` へ遷移
- カラー・シャドウはアプリ全体と同じニューモーフィズムトークン（`base-*` / `ink-*` / `sage-*`、`.nm-card` / `.nm-inset` / `.nm-btn-primary`）を使用
- `"use client"` コンポーネント（Supabase Auth 使用）

---

## ヘッダー構成

```tsx
<header className="nm-nav-top px-5 py-4 sm:px-8 flex items-center justify-between">
  <Link href="/home" className="font-outfit text-xl font-medium text-ink-700 tracking-wide">
    Hibi
  </Link>
  <button onClick={handleLogout} className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition">
    ログアウト
  </button>
</header>
```
