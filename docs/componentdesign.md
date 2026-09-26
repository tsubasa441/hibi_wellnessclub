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
| Header | `src/components/Header.tsx` | ロゴ・歯車アイコン（`SettingsDrawer`を開く）。管理者には「管理画面」リンクも表示 |
| SettingsDrawer | `src/components/SettingsDrawer.tsx` | ヘッダーの歯車アイコンで開く、右からスライドインするドロワー。ニックネーム変更（`POST /api/profile/nickname`）・ログアウト・アカウント削除（`POST /api/account/delete`）を提供 |
| PublicHeader | `src/components/PublicHeader.tsx` | 未ログインで見られるページ用の共通ヘッダー。`.nm-nav-top`（nav-bg背景）バーに「Hibi」ロゴ（`/` へのリンク）のみ。トップ・法定ページ（特商法・プライバシー・利用規約）に設置。ログイン後の画面は `Header`（設定ドロワー付き）を使う。**`/login`・`/register-complete`には設置しない**（2026-09-25のリデザインで写真パネル内の独自ロゴ表示に置き換え） |
| AuthPhotoPanel | `src/components/AuthPhotoPanel.tsx` | ログイン・新規登録（`/login`）と登録完了（`/register-complete`）で共通の写真パネル（写真＋暗幕・「Hibi」ロゴ・「WELLNESS CLUB」・デスクトップのみタグライン）。Server Component |
| BottomNav | `src/components/BottomNav.tsx` | 下部ナビゲーション（Home / Event / Impact） |
| RankIcon | `src/components/RankIcon.tsx` | ランクアイコン表示 |
| PasswordInput | `src/components/PasswordInput.tsx` | 目のアイコンで表示/非表示を切り替えられるパスワード入力欄 |
| Footer | `src/components/Footer.tsx` | Instagram・TikTok のアイコンリンク（上段）と、利用規約・プライバシーポリシー・特定商取引法に基づく表記へのリンク（下段）を表示する共通フッター。トップ・法定ページに設置（固定 BottomNav のある認証後画面には未設置）。SNS アイコンは SVG アウトライン（`currentColor`）で、外部リンクは新しいタブで開く。見た目は Header/BottomNav と同じ `.nm-nav-bottom`（nav-bg背景）。**`/login`・`/register-complete`には設置しない**（2026-09-25、新規登録フォーム内の利用規約・プライバシーポリシーリンクで代替） |

ボタン・カードは共通コンポーネント化せず、下記バリエーションのユーティリティクラスをその都度使用する。

---

## ページ固有コンポーネント

| コンポーネント | パス | 説明 | Client? |
|-------------|------|------|---------|
| LoginForm | `app/login/LoginForm.tsx` | ログイン・新規登録・パスワード再設定リクエストフォーム | ✅ |
| BookingButton | `app/events/[id]/BookingButton.tsx` | 予約・決済ボタン | ✅ |
| CheckoutForm | `app/events/[id]/checkout/CheckoutForm.tsx` | 決済フォーム | ✅ |
| ReferralShare | `app/impact/ReferralShare.tsx` | URLコピー・シェアボタン | ✅ |
| EventOptionFields | `app/events/[id]/EventOptionFields.tsx` | イベント選択項目の入力（単一=`<select>` / 複数=チェックボックスパネル型ドロップダウン） | ✅ |
| CheckInButton | `app/bookings/CheckInButton.tsx` | 予約カードのチェックインボタン。現在時刻を30秒ごとに再評価し、イベント開始〜終了時刻のみ活性。チェックイン済みは「チェックイン済み」表示 | ✅ |
| VerifyForm | `app/auth/verify/VerifyForm.tsx` | パスワード再設定の確認ページのフォーム。「パスワードを再設定する」ボタンで `POST /auth/confirm`。送信中はボタンを無効化して二重押しを防ぐ | ✅ |
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
| ヘッダー | `Header.tsx` と同じ `.nm-nav-top`（nav-bg背景）バー。中身は「Hibi」ロゴのみ（未ログインのためログアウト等のリンクはなし）。`page.tsx` 内に直接実装、ヒーローより前に通常フローで配置（オーバーレイではない） |
| 背景 | `HeroBackground`（Client Component）が写真・動画のスライドを一定間隔（7秒）でクロスフェード切り替え。黒オーバーレイ bg-black/20 は固定。スライドは `page.tsx` の `HERO_SLIDES` 配列で管理し、現状は `public/videos/hibi-top.mp4`（ループ再生）1本のみ。複数件になると自動でクロスフェード切り替えが有効になる |
| 中央上部 | 「Hibi」テキスト（font-outfit / text-5xl / white） |
| Hibi直下 | 「Wellness Club」（font-outfit / uppercase / text-xs / white/90 / tracking-[0.3em]。ログイン画面と統一） |
| 中央 | コンセプトコピー2行 |
| 下部 | 「イベントご参加の方はこちら」ボタン → `/login` へ遷移 |
| フッター | 共通 `Footer.tsx`。`.nm-nav-bottom`（nav-bg背景）バーに統一（2026-09、ヘッダーと合わせて変更。中身の法定表記リンクは変更なし） |

### 表示内容

- **Hibi**: テキストで表示（画像ロゴは使用しない）
- **Wellness Club**: Hibi直下にサブテキストとして表示
- **コンセプトコピー1行目**: 「なんでもない日々が、輝きだす。」（font-dm / text-sm / white）
- **コンセプトコピー2行目**: 「からだを動かし、気の合う仲間と出会い、毎日に新しい彩りが生まれる。運動からはじまる、大人のウェルネスコミュニティ。」（font-cormorant / text-[10px] / white/80）
- **ボタン**: 「イベントご参加の方はこちら」（bg-white/90 / text-brown-600 / rounded-full）→ `/login` へ遷移

---

## ログイン・新規登録ページ（`/login`）

2026-09-25にエディトリアル方向へ全面リデザイン。アプリ内の他画面（home・impact等）が使うニューモーフィズム（`nm-*`）とは意図的に異なるトーンで、写真を主役にした分割レイアウトにする。`PublicHeader`・`Footer`はこのページには設置しない。写真パネルは共通の `AuthPhotoPanel` を使い、登録完了画面（`/register-complete`）も同じ分割レイアウト・見出し（`font-yugothic`「Welcome to Hibi!」）・フラットなボタンで揃える（写真パネル内の「Hibi」ロゴ＋新規登録フォーム内の利用規約・プライバシーポリシーリンクで代替）。

### レイアウト構成

| エリア | 内容 |
|--------|------|
| 写真パネル | 画面左42%（モバイルは上部・高さ200px固定）。`public/images/hibi-top-poster.jpg`を`object-cover`、`bg-ink-800/40`の暗幕オーバーレイ。「Hibi」ロゴ（`font-outfit font-medium`・白。トップページと統一）＋「WELLNESS CLUB」（`font-outfit`）、下部にタグライン（デスクトップのみ表示） |
| フォームパネル | 残り58%を中央揃え、最大幅`max-w-sm` |
| タブ | 「ログイン」「新規登録」を下線式切り替え（アクティブ時`border-sage-600 text-ink-700`、非アクティブ`border-transparent text-ink-300`）。ピル型トグルは廃止 |
| 見出し | `font-yugothic text-2xl font-bold`（游ゴシック。Windows・Mac 標準、Android では sans-serif で代替表示。ログイン「Hello!」・新規登録「Nice to meet you!」） |
| 入力欄 | 下線のみ（`border-b border-base-200`、フォーカス時`border-ink-500`）。囲み枠・凹み表現（`nm-inset`）は使わない |
| ボタン | フラットな`rounded-sm`・`bg-sage-600`（`nm-btn-primary`のシャドウ表現は使わない） |

### 仕様

- ログイン／新規登録／パスワード再設定を1ページ内でタブ・状態切り替え（`useState`で制御。ロジックは変更なし）
- ログインフォーム: EMAIL・PASSWORD
- 新規登録フォーム: NAME・NICKNAME・EMAIL・PASSWORD・GENDER・DATE OF BIRTH・REFERRAL CODE（任意）— 項目は変更前と同一
- タブ切り替え時にフォームをリセット
- ログイン成功後 `/home` へ、新規登録成功後 `/register-complete` へ遷移
- カラーはアプリ全体と同じトークン（`base-*` / `ink-*` / `sage-*`）を使用するが、ニューモーフィズム系クラス（`.nm-card` / `.nm-inset` / `.nm-btn-primary`）は使わずフラットな表現にする
- `"use client"` コンポーネント（Supabase Auth 使用）

---

## ヘッダー構成

背景は `.nm-nav-top`（`--color-nav-bg` 適用）で `BottomNav`（`.nm-nav-bottom`）と共通。テキストはすべて `ink-700` 系で視認性を優先し、ロゴは太字・大きめにする（2026-09、参考UIに合わせて変更）。右端はログアウト等の個別ボタンではなく、歯車アイコン（`SettingsDrawer`）1つに集約する（2026-09-23）。

```tsx
<header className="nm-nav-top px-5 py-4 sm:px-8 flex items-center justify-between">
  <Link href="/home" className="font-outfit text-2xl font-bold text-ink-700 tracking-wide">
    Hibi
  </Link>
  <SettingsDrawer nickname={nickname} />
</header>
```

### SettingsDrawer（設定ドロワー）

ヘッダーの歯車アイコンを押すと、画面右からスライドインするドロワー（`RankGuideModal`と同じ`createPortal`＋`fixed inset-0 bg-black/50`のオーバーレイパターンを踏襲、背景は白）が開き、以下を提供する。

- **ニックネーム変更**：現在のニックネーム表示＋「変更する」でインライン編集。保存は`POST /api/profile/nickname`（サインアップ時と同じバリデーション：1〜20文字、絵文字・記号のみ不可）
- **ログアウト**
- **アカウントを削除する**：確認ダイアログ→`POST /api/account/delete`（旧`DeleteAccountButton`から移設。`/impact`画面からは撤去済み）

オーバーレイクリック・×ボタンで閉じる。ドロワーのスライドインは`globals.css`の`.animate-slide-in-right`（0.25s ease-out）を使用。
