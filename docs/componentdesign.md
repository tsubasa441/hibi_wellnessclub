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
| SettingsDrawer | `src/components/SettingsDrawer.tsx` | ヘッダーの歯車アイコンで開く、右からスライドインするドロワー。ニックネーム変更（`POST /api/profile/nickname`）・パスワード変更・クレジットカード登録/変更（`POST /api/payment-methods/square`）・ログアウト・アカウント削除（`POST /api/account/delete`）を提供 |
| PublicHeader | `src/components/PublicHeader.tsx` | 未ログインで見られるページ用の共通ヘッダー。`.nm-nav-top`（nav-bg背景）バーに「Hibi」ロゴ（`/` へのリンク）のみ。法定ページ（特商法・プライバシー・利用規約）に設置（トップページからは 2026-10-12 に撤去）。ログイン後の画面は `Header`（設定ドロワー付き）を使う。**`/login`・`/register-complete`には設置しない**（2026-09-25のリデザインで写真パネル内の独自ロゴ表示に置き換え） |
| AuthPhotoPanel | `src/components/AuthPhotoPanel.tsx` | ログイン・新規登録（`/login`）・登録完了（`/register-complete`）・パスワード再設定（`/auth/verify`・`/auth/reset-password`）で共通の写真パネル（写真＋暗幕・「Hibi」ロゴ・「WELLNESS CLUB」・デスクトップのみタグライン）。Server Component |
| BottomNav | `src/components/BottomNav.tsx` | 下部ナビゲーション（Home / Event / Impact） |
| RankIcon | `src/components/RankIcon.tsx` | ランクアイコン表示 |
| EventTypeIcon | `src/components/EventTypeIcon.tsx` | イベント種別（yoga / running / boxing / training / pilates）の円形ピクトグラム。円の色は `globals.css` の `--color-event-*` トークン、図柄は Google Material Symbols（Rounded / Fill、Apache License 2.0）の白い塗りつぶしアイコン（`currentColor`）。ヨガ=`self_improvement`、ランニング=`directions_run`、ボクシング=`sports_mma`、トレーニング=`fitness_center`、ピラティス=`sports_gymnastics`。イベント一覧（`/events`）のカード左側に表示する。`size="lg"`（80px）はトップページの Program のカード用。Server Component |
| PasswordInput | `src/components/PasswordInput.tsx` | 目のアイコンで表示/非表示を切り替えられるパスワード入力欄 |
| Footer | `src/components/Footer.tsx` | トップ・法定ページ共通のフッター（固定 BottomNav のある認証後画面には未設置）。2026-10-12 に参考サイトに合わせて作り直し：背景 `bg-ink-700`・白文字。左に「Hibi / wellness club」と一言（「なんでもない日々が輝きだす」＋英訳）、右に「Stay Updated With Us」と連絡先（Instagram・TikTok・Email。`CONTACT_LINKS` で管理、SVG アウトラインのアイコン付き、SNS は新しいタブ、Email は `mailto:`）。最下段は `bg-ink-800` の帯に「© 2026 Hibi Wellness Club. All Rights Reserved.」と利用規約・プライバシーポリシー・特定商取引法に基づく表記へのリンク。住所・電話番号は特商法ページで「請求があれば開示」としているため載せない。sm 以上は左右2列。**`/login`・`/register-complete`には設置しない**（2026-09-25、新規登録フォーム内の利用規約・プライバシーポリシーリンクで代替） |

ボタン・カードは共通コンポーネント化せず、下記バリエーションのユーティリティクラスをその都度使用する。

---

## ページ固有コンポーネント

| コンポーネント | パス | 説明 | Client? |
|-------------|------|------|---------|
| ProgramCarousel | `app/ProgramCarousel.tsx` | トップページの Program（5クラスのカードを自動送り・スワイプ・矢印で切り替えるスライド） | ✅ |
| LoginForm | `app/login/LoginForm.tsx` | ログイン・新規登録・パスワード再設定リクエストフォーム | ✅ |
| BookingButton | `app/events/[id]/BookingButton.tsx` | 予約・決済ボタン | ✅ |
| CheckoutForm | `app/events/[id]/checkout/CheckoutForm.tsx` | 決済フォーム。保存済みクレジットカードがある場合はカード入力欄の代わりに「登録済みのカードで支払う」表示（「別のカードを使う」で入力欄に切り替え可能）。新しいカードで支払うと決済成功後に自動保存される（クレジットカード保存機能） | ✅ |
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

2026-10-12 に、画面全体に動画を敷く構成から、「余白のある角丸のヒーローカード」＋「紹介文ブロック」の縦に並ぶ構成へ変更（依頼者が参考サイトのレイアウトを指定）。同日、依頼者の指定でヘッダーを撤去し、ページ背景をヘッダー・フッターと同じ `nav-bg` にした。

### レイアウト構成

| エリア | 内容 |
|--------|------|
| ヘッダー | なし（トップページのみ。法定ページ等は従来どおり `PublicHeader`） |
| ページ背景 | `bg-nav-bg`（ヘッダー・フッターと同じ色。`nav-bg` を Header/BottomNav 以外で使う例外。依頼者の指定）。左右 16px（sm 以上 24px）の余白 |
| ロゴ（カードの上） | 中央揃えで「Hibi」（`h1`・font-outfit / text-4xl〜5xl / ink-700）と「wellness club」（小文字・font-outfit / tracking-[0.3em] / ink-500）。動画の外、ページ背景の上に置く（参考サイトの配置に合わせた） |
| ヒーローカード | 最大幅 `max-w-5xl`・`rounded-2xl`・高さは画面の約3割（`30svh`、sm 以上 `38svh`、220〜380px。2026-10-12 に依頼者の指摘で4回短くし、あわせて見出し・ボタンも小さくした）。最初の画面にはロゴ・カード・紹介文が入る。`main` に `min-h-[calc(100svh+1.5rem)]` を付け、ページが短くてもフッター（影を含む）は最初の画面に出さず、スクロールした最後に表示する。中に `HeroBackground`（Client Component、`HERO_SLIDES` の写真・動画を7秒ごとにクロスフェード。現状は `public/videos/hibi-top.mp4` 1本でループ再生）と黒の重ね `bg-black/30` |
| カード内（中央） | 見出し「THE CITY IS YOUR STUDIO.」（`font-bebas`＝Bebas Neue / 大文字 / 30px・sm 以上 52px / white / 1行。依頼者が4案を実際の写真の上で比較して選択）、その下にクラス種別のキャッチ「RUN · TRAINING · BOXING · YOGA · PILATES」（font-outfit / 10px・sm 以上 text-xs / 1行に収める）と、「イベントご参加の方はこちら」ボタン（白のピル型・text-base・高さ56px（`min-h-14`）。2026-10-13 に依頼者の指摘で押しやすい大きさに戻した → `/login`） |
| 紹介文ブロック | カードの下、中央揃え・最大幅 `max-w-2xl`。見出し「なんでもない日々が輝きだす」（読点・句点なし・1行。本文と同じ `font-zenkaku`（Zen Kaku Gothic New）・本文と同じ通常の太さ（400） / 18px・sm 以上 24px / ink-700。上にあった「WELCOME TO HIBI」の行は 2026-10-13 に依頼者の指定で削除）、本文「からだを動かし、気の合う仲間と出会い、毎日に新しい彩りが生まれる。運動からはじまる、大人のウェルネスコミュニティ。」（`font-zenkaku`＝Zen Kaku Gothic New / ink-500 / 3行。依頼者が比較のうえ選択）。見出し・本文それぞれの下に英訳（`lang="en"`）を添える：見出し「Ordinary days begin to shine.」（font-outfit / ink-400）、本文「Move your body, meet people you click with, / and find new color in every day. / A wellness community for grown-ups, beginning with movement.」（font-dm / text-xs〜sm / ink-300。スマホでは最後の文を2行に分ける） |
| Program | 紹介文の下。見出し「PROGRAM」（参考サイトのセクション見出しに合わせ、端末標準のゴシック体（`font-sans`）・太字・大文字・28〜31px・`text-navy`）と、`ProgramCarousel`（5クラスのカード：Run・Training・Boxing・Yoga・Pilates。各カードは種別アイコン（`EventTypeIcon` の `size="lg"`）・英名（font-bebas）・日本語名・説明文（各運動の特徴・効果。font-zenkaku）・その英訳（`lang="en"`・font-dm・ink-300）。説明文はイベントごとに変わる日時・場所・料金を含めない。日本語の説明文は文節ごとの配列で持ち、各文節を `inline-block` にして単語の途中で改行されないようにする）。スマホは1枚＋次のカードが少し見える幅、sm 以上は3枚並び。4.5秒ごとに自動で次へ送り、最後の次は先頭へ戻る。スマホは横スワイプ、sm 以上は左右の矢印、下の点でも切り替え可。マウスを乗せている間は止まり、指・矢印・点で操作したあとは8秒間止まる。`prefers-reduced-motion` のときは自動送りしない（2026-10-12 追加） |
| 退会直後のお知らせ | `?accountDeleted=1` のとき、ヒーローカードの上に白いお知らせ（rounded-2xl）を表示 |
| フッター | 共通 `Footer.tsx`（固定ではなく、ページの最後に表示） |

---

## ログイン・新規登録ページ（`/login`）

2026-09-25にエディトリアル方向へ全面リデザイン。アプリ内の他画面（home・impact等）が使うニューモーフィズム（`nm-*`）とは意図的に異なるトーンで、写真を主役にした分割レイアウトにする。`PublicHeader`・`Footer`はこのページには設置しない。写真パネルは共通の `AuthPhotoPanel` を使い、登録完了画面（`/register-complete`）・パスワード再設定の2画面（`/auth/verify`・`/auth/reset-password`）も同じ分割レイアウト・見出し（`font-yugothic`）・下線入力欄・フラットなボタンで揃える。入力欄・ラベル・ボタン・見出しのクラスは `src/lib/authStyles.ts` に集約し、これらの画面で共用する（写真パネル内の「Hibi」ロゴ＋新規登録フォーム内の利用規約・プライバシーポリシーリンクで代替）。

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

- **ニックネーム変更**：現在のニックネーム表示＋「変更する」でインライン編集。保存は`POST /api/profile/nickname`（サインアップ時と同じバリデーション、`src/lib/nameValidation.ts` の `validateNickname`：1〜20文字、漢字・ひらがな・カタカナ・英数字・スペースと文字間の「ー」「・」のみ。記号・絵文字は不可。全角英数字・半角カナは NFKC で揃えてから判定・保存）
- **パスワード変更**：現在のパスワード・新しいパスワード・確認の3つを入力。`signInWithPassword`で現在のパスワードを確認してから`updateUser`で変更する（本人以外がログイン中の端末を操作しただけで変更できてしまわないようにするため）。バリデーション（`src/lib/passwordPolicy.ts`）・失敗時の文言（`src/lib/passwordUpdateError.ts`）は再設定画面（`/auth/reset-password`）と共通
- **クレジットカード**：現在の保存済みカード（ブランド・下4桁・有効期限）を表示、無い場合は「登録されていません」。行を押すとインラインで Square のカード入力欄が開き、保存は`POST /api/payment-methods/square`（クレジットカード保存機能、`docs/funcdocument.md`の5-2参照）。入力欄の読み込み・トークン化は`src/lib/useSquareCard.ts`を`CheckoutForm`と共用
- **ログアウト**
- **アカウントを削除する**：確認ダイアログ→`POST /api/account/delete`（旧`DeleteAccountButton`から移設。`/impact`画面からは撤去済み）

オーバーレイクリック・×ボタンで閉じる。ドロワーのスライドインは`globals.css`の`.animate-slide-in-right`（0.25s ease-out）を使用。
