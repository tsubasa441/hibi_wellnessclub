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
| LoadingScreen | `src/components/LoadingScreen.tsx` | 画面遷移・処理待ちの間に全画面で出す読み込み画面（2026-10-24、依頼者の指定で読み込み中の枠 `PageSkeleton` から置き換え。参考：他サイトの遷移画面）。ぼかしたセージ・インク系の色の層（`blur-3xl`）がゆっくり流れる背景に、4つに区切った白い輪（6秒で1回転）と内側の点線の輪（逆回転）、中央に白いロゴ（`hibi-logo-white.png`）＋「wellness club」（ゆっくり明滅）。すぐ終わる遷移でちらつかないよう 0.15 秒遅れて現れる。`prefers-reduced-motion` のときは動かさない。下ナビより前面（`z-[60]`）。各画面の `loading.tsx`（ホーム・イベント一覧/詳細・予約済み・チェックイン・インパクト・マイページ・お問い合わせ）から使う。アニメーションは `globals.css` の `animate-loading-*`。Server Component |
| AppFooter | `src/components/AppFooter.tsx` | ログイン後の画面（ホーム・イベント一覧・インパクト・マイページ）の最下部に置くフッター（2026-10-24、依頼者の指定。参考：会員制スタジオのアプリ）。色はトップ・法定ページの `Footer` と同じ（`bg-ink-700`・白文字。同日、依頼者の指定で薄いグレーから変更）。左にロゴ画像（白版の `hibi-logo-white.png`・高さ スマホ 20px／sm 以上 28px）＋「wellness club」（font-dm・white/80）、右によくあるご質問（`/faq`）・利用規約・プライバシーポリシー・特定商取引法に基づく表記へのリンクを2行×2列で並べる（`grid-flow-col grid-rows-2`。短いもの同士・長いもの同士が縦に組まれ、スマホ 375px 幅にも収まる。文字はスマホ 11px／sm 以上 12px。同日、高いとの指摘で2回詰めた）。親の `main` を `flex flex-col` にして `mt-auto` で画面の下端に寄せ、下に 92px の余白を取る（下ナビから浮いたチェックインの丸ボタンがリンクに重ならない高さ。スマホで下ナビの上に見える帯は約 78px）。Server Component |
| Header | `src/components/Header.tsx` | ロゴ。管理者には「管理画面」リンクも表示（歯車アイコンは 2026-10-16 に撤去） |
| SettingsMenu | `src/components/SettingsMenu.tsx` | マイページのアカウント設定。ニックネーム変更（`POST /api/profile/nickname`）・パスワード変更・クレジットカード登録/変更（`POST /api/payment-methods/square`）・ログアウト・アカウント削除（`POST /api/account/delete`）を提供（2026-10-16 に旧 `SettingsDrawer` から移設） |
| SupportChat | `src/components/SupportChat.tsx` | お問い合わせのチャット（ユーザーの `/support`・管理画面の `/admin/support/[userId]` で共通）。自分の吹き出しは右・`bg-sage-600` 白文字、相手は左・`bg-base-100`（上に「Hibi 運営」等）。下に入力欄（2000文字・文字数表示）と送信ボタン。送信後と、開いている間の20秒ごとに `router.refresh()` で新着を取り直す |
| ReserveTabs | `src/components/ReserveTabs.tsx` | 下ナビ「予約」内で、イベント一覧（`/events`）と予約済み一覧（`/bookings`）を切り替えるピル型の2択 |
| PublicHeader | `src/components/PublicHeader.tsx` | 未ログインで見られるページ用の共通ヘッダー。`.nm-nav-top`（nav-bg背景）バーに「Hibi」ロゴ（`/` へのリンク）のみ。法定ページ（特商法・プライバシー・利用規約）に設置（トップページからは 2026-10-12 に撤去）。ログイン後の画面は `Header` を使う。**`/login`・`/register-complete`には設置しない**（`AuthShell` 内のロゴ表示で代替） |
| AuthShell | `src/components/AuthShell.tsx` | ログイン・新規登録（`/login`）・登録完了（`/register-complete`）・パスワード再設定（`/auth/verify`・`/auth/reset-password`）で共通の外枠（`nav-bg` の背景・ロゴ・白いカード）。`above` でカードの上（ログインのタブ）を差し込める。2026-10-22 に写真パネルの `AuthPhotoPanel` から置き換え |
| BottomNav | `src/components/BottomNav.tsx` | 下部ナビゲーション（ホーム / 予約 / チェックイン（中央の丸ボタン） / インパクト / マイページ。下記「下ナビ」参照） |
| RankIcon | `src/components/RankIcon.tsx` | ランクアイコン表示 |
| EventTypeIcon | `src/components/EventTypeIcon.tsx` | イベント種別（yoga / running / boxing / training / pilates）の円形ピクトグラム。円の色は `globals.css` の `--color-event-*` トークン、図柄は Google Material Symbols（Rounded / Fill、Apache License 2.0）の白い塗りつぶしアイコン（`currentColor`）。ヨガ=`self_improvement`、ランニング=`directions_run`、ボクシング=`sports_mma`、トレーニング=`fitness_center`、ピラティス=`sports_gymnastics`。イベント一覧（`/events`）のカード左側に表示する。`size="lg"`（80px）はトップページの Program のカード用。Server Component |
| EventCard | `src/components/EventCard.tsx` | イベント一覧（`/events`）とホーム（予約済みイベント・次回のイベント）で共通のイベントカード。左に種別アイコン（`EventTypeIcon`）とその下に種別名のピル（左の列は幅 92px で固定し、種別名のピルもその幅いっぱい＝一番長い「トレーニング」（6文字）に合わせた同じ幅で、文字は中央揃え。種別名の長さでアイコン・ピル・右の文字の位置や大きさがずれないように。2026-10-25、依頼者の指摘）、右に日時（`2026/11/10(火) 16:00 - 17:00`、24時間表記・JST）・イベント名・開催場所（ピンのアイコン付き）。料金・定員は出さない（2026-10-18、依頼者の指定）。カード全体がイベント詳細へのリンク。Server Component |
| RefreshAt | `src/components/RefreshAt.tsx` | 画面を開いたまま指定の時刻を過ぎたら `router.refresh()` で表示を取り直す（何も描画しない）。ホーム・予約済みイベント・チェックイン画面で、表示中のイベントの一番早い終了時刻を渡し、終了したイベントのカードを自動で消す。24時間より先の時刻は見送る。Client Component |
| PasswordInput | `src/components/PasswordInput.tsx` | 目のアイコンで表示/非表示を切り替えられるパスワード入力欄 |
| Footer | `src/components/Footer.tsx` | トップ・法定ページ共通のフッター（固定 BottomNav のある認証後画面には未設置）。2026-10-12 に参考サイトに合わせて作り直し：背景 `bg-ink-700`・白文字。左に「Hibi / wellness club」（「Hibi」はトップと同じロゴの白版の画像 `public/images/hibi-logo-white.png`・高さ 24px、「wellness club」は font-dm。2026-10-21 に依頼者の指定で Outfit の文字から変更）と一言（「なんでもない日々が輝きだす」＋英訳）、右に「Stay Updated With Us」と連絡先（Instagram・TikTok・Email。`CONTACT_LINKS` で管理、SVG アウトラインのアイコン付き、SNS は新しいタブ、Email は `mailto:`）。最下段は `bg-ink-800` の帯に「© 2026 Hibi Wellness Club. All Rights Reserved.」と利用規約・プライバシーポリシー・特定商取引法に基づく表記へのリンク。住所・電話番号は特商法ページで「請求があれば開示」としているため載せない。sm 以上は左右2列。**`/login`・`/register-complete`には設置しない**（2026-09-25、新規登録フォーム内の利用規約・プライバシーポリシーリンクで代替） |

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
| GrowthRings | `app/impact/GrowthRings.tsx` | インパクト画面の「年輪」。8つのランク（種→大樹）を内側から8本の輪で描き、到達したランクは塗り（`sage-50`）、次のランクの輪は進み具合の分だけ白い弧、それより先は点線。中心に `RankIcon`。SVG | - |
| ReachRipple | `app/impact/ReachRipple.tsx` | 「あなたから広がった幸せ」の波紋。中心があなた、広がった人を点で描く（12人まで）。SVG | - |
| EventOptionFields | `app/events/[id]/EventOptionFields.tsx` | イベント選択項目の入力（単一=`<select>` / 複数=チェックボックスパネル型ドロップダウン） | ✅ |
| CheckInButton | `app/bookings/CheckInButton.tsx` | 予約カードのチェックインボタン。現在時刻を30秒ごとに再評価し、イベント開始〜終了時刻のみ活性。チェックイン済みは「チェックイン済み」表示。`size="lg"` はチェックイン画面（`/checkin`）用の横幅いっぱいのボタン | ✅ |
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

ログイン後の画面（ホーム・イベント一覧/詳細・決済・予約済み・チェックイン・インパクト・マイページ・お問い合わせ・よくあるご質問）のカードは、2026-10-24 に依頼者の指定（参考：会員制スタジオのアプリ）で、角丸・枠線・影なしの白い帯に変更した。スマホはページの左右の余白（`px-4`）を `-mx-4` で打ち消して画面の端から端まで広げ、帯と帯の間は背景色の隙間で区切る（sm 以上は `sm:mx-0` で本文の幅に収める）。一覧の行は細い線（`divide-y divide-base-200`）で区切る。カード内の小さな枠・入力欄・エラー表示も角丸なし。画面の主なボタン（予約済み・チェックインの「イベントを探す」、イベント詳細の「予約する」等、決済の支払いボタン、インパクトの「紹介リンクをシェア」「リンクをコピー」、お問い合わせの「送信する」）は、同日の依頼者の指定で角丸 6px（`rounded-md`）の四角寄りに揃えた。色は 2026-10-25 に依頼者の指定でインク色（`bg-ink-500`、ホバーは下ナビと同じ `sage-600`。最初は hover `ink-600` にしたが、色の差が小さくホバーが分からないとの指摘で同日変更）に揃えた（マイページの「保存する」「変更する」「確認メールを送る」も同じ。チェックインボタンと、切り替え・下ナビの選択中の緑は従来どおり）。ラベル（種別・ランクのピル）・切り替え（`ReserveTabs`）・種別アイコンやバッジの円形・お問い合わせの吹き出し・モーダルは丸いまま。

```tsx
// ログイン後の画面のカード（白い帯）
<div className="bg-white -mx-4 sm:mx-0 px-4 py-5 sm:px-5">
  ...
</div>
```

以下は管理画面・認証画面など、上記以外の画面のカード。

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
| ロゴ（カードの上） | 中央揃えで「Hibi」のロゴ画像（`h1` 内の `<Image>`、`public/images/hibi-logo.png`。`hibi_logo.jpg` から文字だけを透過 PNG に切り出したもの・高さ 32px、sm 以上 36px（同日、依頼者の指摘で 40px・48px から縮小）。2026-10-21 に依頼者の指定で Outfit の文字から変更）と「wellness club」（小文字・font-dm / tracking-[0.1em] / ink-500。2026-10-21 に依頼者の指定で Outfit・0.3em から変更）。動画の外、ページ背景の上に置く（参考サイトの配置に合わせた） |
| ヒーローカード | 最大幅 `max-w-5xl`・`rounded-2xl`・高さは画面の約3割（`30svh`、sm 以上 `38svh`、220〜380px。2026-10-12 に依頼者の指摘で4回短くし、あわせて見出し・ボタンも小さくした）。最初の画面にはロゴ・カード・紹介文が入る。`main` に `min-h-[calc(100svh+1.5rem)]` を付け、ページが短くてもフッター（影を含む）は最初の画面に出さず、スクロールした最後に表示する。中に `HeroBackground`（Client Component、`HERO_SLIDES` の写真・動画を7秒ごとにクロスフェード。現状は `public/videos/hibi-top.mp4` 1本でループ再生）と黒の重ね `bg-black/30` |
| カード内（中央） | 見出し「THE CITY IS YOUR STUDIO.」（`font-bebas`＝Bebas Neue / 大文字 / 30px・sm 以上 52px / white / 1行。依頼者が4案を実際の写真の上で比較して選択）、その下にサブコピー「この街ごと、スタジオに変える」（`font-zenkaku` / 12px・sm 以上 14px / white/90 / 1行に収める。2026-10-21 に依頼者の指定でクラス種別の「RUN · TRAINING · BOXING · YOGA · PILATES」から変更）と、「イベントご参加の方はこちら」ボタン（白のピル型・text-base・高さ56px（`min-h-14`）。2026-10-13 に依頼者の指摘で押しやすい大きさに戻した → `/login`）。見出し・サブコピーはボタンより上の残りの高さの中央に置き、ボタンは動画枠の下端から 24px（sm 以上 40px）の位置に固定する（2026-10-21、依頼者の指定でボタンを下げた） |
| 紹介文ブロック | カードの下、中央揃え・最大幅 `max-w-2xl`。見出し「なんでもない日々が輝きだす」（読点・句点なし・1行。本文と同じ `font-zenkaku`（Zen Kaku Gothic New）・太字（700。2026-10-21 に依頼者の指定で通常の太さ 400 から変更） / 18px・sm 以上 24px / ink-700。上にあった「WELCOME TO HIBI」の行は 2026-10-13 に依頼者の指定で削除）、本文「からだを動かし、気の合う仲間と出会い、毎日に新しい彩りが生まれる。運動からはじまる、大人のウェルネスコミュニティ。」（`font-zenkaku`＝Zen Kaku Gothic New / ink-500 / 3行。依頼者が比較のうえ選択）。見出し・本文それぞれの下に英訳（`lang="en"`）を添える：見出し「Ordinary days begin to shine.」（font-dm / ink-400。2026-10-21 に Outfit から変更）、本文「Move your body, meet people you click with, / and find new color in every day. / A wellness community for grown-ups, beginning with movement.」（font-dm / text-xs〜sm / ink-300。スマホでは最後の文を2行に分ける） |
| Program | 紹介文の下。見出し「PROGRAM」（ヒーロー見出しと同じ `font-bebas`・大文字・34px（sm 以上 40px）・ロゴと同じ色の `text-logo`。2026-10-21 に依頼者の指定で端末標準のゴシック体・太字・`text-navy` から変更）と、`ProgramCarousel`（5クラスのカード：Run・Training・Boxing・Yoga・Pilates。各カードは種別アイコン（`EventTypeIcon` の `size="lg"`）・英名（font-bebas）・日本語名・説明文（各運動の特徴・効果。font-zenkaku）・その英訳（`lang="en"`・font-dm・ink-300）。説明文はイベントごとに変わる日時・場所・料金を含めない。日本語の説明文は文節ごとの配列で持ち、各文節を `inline-block` にして単語の途中で改行されないようにする）。スマホは1枚＋次のカードが少し見える幅、sm 以上は3枚並び。4.5秒ごとに自動で次へ送り、最後の次は先頭へ戻る。スマホは横スワイプ、sm 以上は左右の矢印、下の点でも切り替え可。マウスを乗せている間は止まり、指・矢印・点で操作したあとは8秒間止まる。`prefers-reduced-motion` のときは自動送りしない（2026-10-12 追加） |
| 退会直後のお知らせ | `?accountDeleted=1` のとき、`AccountDeletedToast`（Client Component）が共通の `Toast` で「アカウントを削除しました。ご利用ありがとうございました。」を約4秒だけ表示し、表示と同時に `history.replaceState` で URL から `?accountDeleted=1` を消す（再読み込みで出続けないように。2026-10-14、依頼者の指摘で変更） |
| フッター | 共通 `Footer.tsx`（固定ではなく、ページの最後に表示） |

---

## ログイン・新規登録ページ（`/login`）

2026-10-22、依頼者の指定で、2026-09-25 の写真パネル＋分割レイアウト（`AuthPhotoPanel`。削除済み）をやめ、ホームと同じテイストにした。登録完了画面（`/register-complete`）・パスワード再設定の2画面（`/auth/verify`・`/auth/reset-password`）も同じ外枠 `AuthShell` とスタイルで揃える。`PublicHeader`・`Footer`はこれらの画面には設置しない（ロゴは `AuthShell` 内、利用規約・プライバシーポリシーへは新規登録フォーム内の同意文言から遷移できる）。

### レイアウト構成

| エリア | 内容 |
|--------|------|
| 背景 | トップ・ホームと同じ `bg-nav-bg` |
| ロゴ | 上部中央にトップと同じロゴ画像（`hibi-logo.png`）＋「wellness club」（font-dm）。`/` へのリンク |
| タブ（`/login` のみ） | 「ログイン」「新規登録」をピル型の2択（`ReserveTabs` と同じ見た目、選択中 `bg-sage-600` 白文字） |
| カード | 最大幅 `max-w-md`、白・`rounded-[20px]`・ホームの `ProfileCard` と同じ影。フォーム・案内文はこの中 |
| 見出し | 英語は `font-bebas`（大文字・34px、`headingEnClass`）。ログイン・新規登録の見出しは、ユーザーへの一言（思わず答えたくなる問いかけ等）を、季節（3〜5月 春／6〜8月 夏／9〜11月 秋／12〜2月 冬）と時間帯（JST の 5〜10時 朝／10〜17時 昼／17〜22時 夕方／22〜5時 夜）に合う候補と、いつでも使える候補（「Hello!」「Nice to meet you!」等）の中からランダムに表示する（2026-10-25、依頼者の指定。候補は `src/lib/greetings.ts`。表示のちらつきを避けるため `login/page.tsx`（サーバー）で選んで `LoginForm` に渡す）。登録完了の「Welcome to Hibi!」は固定。日本語（「パスワードの再設定」等）は Bebas に字形が無いため `font-zenkaku` 太字（`headingClass`） |
| 入力欄 | 囲み枠（`rounded-lg`・`bg-base-50`・フォーカス時 `border-sage-600`。`boxedInputClass`） |
| ボタン | 角丸 6px の四角寄り（`rounded-md`・`bg-ink-500`（ホバーは `sage-600`）・`font-dm`・高さ48px。`primaryButtonClass`。2026-10-25、依頼者の指定でピル型から変更し、ログイン後の画面の主なボタンと揃えた。同日、色も依頼者の指定で `sage-600` からインク色に変更）。性別の選択とログイン／新規登録のタブはピル型のまま |

クラスは `src/lib/authStyles.ts` に集約。`inputClass`・`labelClass`（下線の入力欄）はマイページの `SettingsMenu` 用として残している。

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

背景は `.nm-nav-top`（`--color-nav-bg` 適用）で `BottomNav`（`.nm-nav-bottom`）と共通。2026-10-18 に依頼者の指定で影（ニューモーフィズム）をやめ、ヘッダーの下端・下ナビの上端を細い線で区切る平らな表現にした（Impact の進捗バーの凹み表現も撤去）。テキストはすべて `ink-700` 系で視認性を優先する。ロゴはトップと同じロゴ画像（`public/images/hibi-logo.png`・高さ 16px。2026-10-23 に依頼者の指定で Outfit の文字から変更し、大きいとの指摘で 28px→20px（同日）→16px（2026-10-24）と縮小）。右端は管理者のみ「管理画面」リンク。歯車アイコン（設定ドロワー）は 2026-10-16 に撤去し、設定はマイページへ移した。

```tsx
<header className="nm-nav-top px-5 py-4 sm:px-8 flex items-center justify-between">
  <Link href="/home" className="inline-flex">
    <Image src="/images/hibi-logo.png" alt="Hibi" width={540} height={236} priority className="h-4 w-auto" />
  </Link>
  {isAdmin && <Link href="/admin/events">管理画面</Link>}
</header>
```

---

## 下ナビ（BottomNav）

2026-10-16 に依頼者の指定（参考：会員制スタジオのマイページ）で5タブに変更。`grid-cols-5`、ラベルは日本語・`font-outfit` 10px、選択中は `sage-600`。ホバーは、選択中でないタブ・チェックインの丸ボタンとも選択中と同じ `sage-600` に変わり、選択中のものはホバーで色を変えない（2026-10-25、依頼者の「ホバーの色が統一されていない」との指摘で、タブの `ink-500` と丸ボタンの `sage-600` を揃えた）。

| タブ | 遷移先 | 選択中になるパス |
|------|--------|-----------------|
| ホーム | `/home` | `/home` |
| 予約 | `/events` | `/events`・`/bookings`（配下を含む） |
| チェックイン | `/checkin` | `/checkin` |
| インパクト | `/impact` | `/impact` |
| マイページ | `/mypage` | `/mypage` |

「マイページ」は `/support` でも選択中になり、運営からの未読の返信があるとアイコンの右上に赤い点を付ける（画面を移るたびに本人の未読数を確認。`/support` を開いている間は出さない）。チェックインは中央に一段大きい丸ボタン（56px・`bg-ink-500`、選択中は `bg-sage-600`、`-mt-6` でナビから浮かせ、`ring-4 ring-nav-bg` で縁取り）。

### ReserveTabs（予約タブ内の切り替え）

`/events` と `/bookings` の上部に置くピル型の2択（「イベントを探す」「予約済み」）。選択中は `bg-sage-600` の白文字。Server Component で、`active` で選択中を受け取る。`/bookings` の「ホームへ戻る」矢印はこの切り替えに置き換えて撤去した。

### チェックイン画面（`/checkin`）

本人の確定予約のうち、終了前で、開始日が今日（JST）のもの、または開始済みのもの（23時開始など日付をまたぐイベントは、0時を過ぎても終了まで表示する。2026-10-18 修正）をカードで並べ、`CheckInButton` の `size="lg"`（横幅いっぱい・高さのある緑のボタン）でチェックインする。活性条件（開始〜終了時刻）は `/bookings` と同じ。今日の予約が無い場合は「本日チェックインできるイベントはありません」と、次の予約（無ければ「イベントを探す」ボタン）を表示する。ロード時に PayPay の pending 予約を照会する（`/bookings` と同じ）。

### インパクト（`/impact`）

2026-10-20 に依頼者の指定（グラフィックで見せる）で作り直し。表示する情報は従来と同じ。上から3枚のカード：
1. **年輪**（`bg-sage-600`・白文字）：`GrowthRings`、いまのランク（英名＋和名）、累計参加回数（`font-bebas` の大きな数字）、次のランクまでの回数、ポイント、「ランクについて」（`RankGuideModal` の `triggerClassName` で白文字）。スマホも sm 以上も、年輪を左・文字を右（左揃え）に横並び。年輪はスマホ 112px・sm 以上 180px（2026-10-24、カードが高いとの指摘でスマホの縦並びをやめた）
2. **今月のバッジ**：見出し「n月のバッジ」のみ（右にあった「参加 n回・招待 n人」は 2026-10-21 に依頼者の指定で削除）。10個のバッジを5列のスタンプで並べる（クラス初参加は種別の色、参加回数は `sage-600`、招待は `ink-500`。未取得は点線の輪）。下にバッジボーナスを9マスの目盛り（3・5・9個目に 300・500・1000）で表示
3. **あなたから広がった幸せ**：`ReachRipple` と人数、招待の3ステップ、紹介コード、`ReferralShare`

`ProfileCard` はホーム専用になった（インパクトでは使わない）。

### ホーム（`/home`）

2026-10-21、ログイン前（トップ）とログイン後の画面の雰囲気の差を縮めるため、依頼者の指定でまずホームだけ変更（よければ他の画面へ広げる）：
- ~~ページ背景をトップと同じ `bg-nav-bg`~~ → 2026-10-24、依頼者の指定で他のログイン後の画面と同じ `app-bg`（`base-100`）に戻した
- 「ランクについて」はモーダルではなく、メンバーカード（`ProfileCard`）の下にランク一覧（`RankList` の `variant="rows"`、角丸なしの白い帯・現在のランクは `bg-ink-50`）を開閉する（2026-10-24、依頼者の指定。インパクト画面は従来どおり `RankGuideModal`）。一覧の各ランクのアイコンと英名は `sage-600`、条件の表記は「累計参加数」「招待実績」「参加獲得ポイント」（モーダルと共通）
- 予約済みイベントは開催の近い順に2件、3件目以降は「ほかn件の予約を見る」でその場で開く。次回のイベントは公開イベントを近い順に2件（2026-10-24、依頼者の指定）
- 見出し（「予約済みイベント」「次回のイベント」）は、ピル型のラベル（`rounded-full`・`border-ink-400` の枠・`bg-base-200`・`font-zenkaku` 12px・`ink-700`。2026-10-24、依頼者の指定で 16px の文字だけの見出しから変更）
- `ProfileCard` の累計参加数・Points の数字はトップのヒーロー見出しと同じ `font-bebas`（36px）

### マイページ（`/mypage`）

上から順に：
1. プロフィールカード：人のアイコン（丸）、ランク（`RankIcon`＋英名・和名のピル）、表示名（ニックネーム→ローマ字氏名→氏名の順にフォールバック）、メールアドレス、Member since
2. ショートカット（3列のタイル）：予約済み（`/bookings`）・イベントを探す（`/events`）・お問い合わせ（`/support`。運営からの未読の返信があれば右上に赤い点。2026-10-17 に「友達を招待」から変更）
3. アカウント設定（`SettingsMenu`、下記）
4. フッター（`AppFooter`）：よくあるご質問・利用規約・プライバシーポリシー・特定商取引法に基づく表記へのリンク（以前の「その他」のリンク一覧は、フッターと重なるため 2026-10-24 に依頼者の指定で削除）

### SettingsMenu（アカウント設定）

マイページに置く設定メニュー（2026-10-16 に旧 `SettingsDrawer` の中身を移設。カードの見た目は白背景・`rounded-2xl`・行区切り）。以下を提供する。

- **ニックネーム変更**：現在のニックネーム表示＋「変更する」でインライン編集。保存は`POST /api/profile/nickname`（サインアップ時と同じバリデーション、`src/lib/nameValidation.ts` の `validateNickname`：1〜20文字、漢字・ひらがな・カタカナ・英数字・スペースと文字間の「ー」「・」のみ。記号・絵文字は不可。全角英数字・半角カナは NFKC で揃えてから判定・保存）
- **メールアドレス変更**（2026-10-24 追加）：行に今のメールアドレスを表示。開くと新しいメールアドレスと現在のパスワードを入力し、「確認メールを送る」で`POST /api/account/email`。成功すると「両方に届いたメールのリンクを押すと変更が完了する。それまでは今のアドレスでログイン」と案内する（表示中のアドレスは変えない）。確定後の結果は `/auth/email-change`
- **パスワード変更**：現在のパスワード・新しいパスワード・確認の3つを入力。`signInWithPassword`で現在のパスワードを確認してから`updateUser`で変更する（本人以外がログイン中の端末を操作しただけで変更できてしまわないようにするため）。バリデーション（`src/lib/passwordPolicy.ts`）・失敗時の文言（`src/lib/passwordUpdateError.ts`）は再設定画面（`/auth/reset-password`）と共通
- **クレジットカード**：現在の保存済みカード（ブランド・下4桁・有効期限）を表示、無い場合は「登録されていません」。行を押すとインラインで Square のカード入力欄が開き、保存は`POST /api/payment-methods/square`（クレジットカード保存機能、`docs/funcdocument.md`の5-2参照）。入力欄の読み込み・トークン化は`src/lib/useSquareCard.ts`を`CheckoutForm`と共用
- **ログアウト**
- **アカウントを削除する**：確認ダイアログ→`POST /api/account/delete`（旧`DeleteAccountButton`から移設。`/impact`画面からは撤去済み）

ログアウト・退会は、アカウント設定とは別のカードに分けて置く。現在のパスワードの確認に使うメールアドレスは、マイページ（Server Component）から渡す。
