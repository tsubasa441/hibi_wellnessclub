# Hibi 認証設計

---

## 認証方式

Supabase Auth を使用。メールアドレス + パスワード認証のみ。

---

## 認証フロー

### 新規登録（/login の SIGN UP タブ）

```
1. ユーザーが姓・名・フリガナ（セイ・メイ）・メール・パスワード・性別・生年月日・紹介コード（任意）を入力（2026-10-25 にニックネームの入力欄を廃止し、フリガナを追加）
   - 「登録」ボタンの直前に「『登録』を押すと、利用規約とプライバシーポリシーに同意したものとみなします」と表示し、`/legal/terms`・`/legal/privacy` へのリンクを置く（入力内容が消えないよう別タブで開く。チェックボックスは設けない）
2. supabase.auth.signUp() を呼び出す（メタデータは渡さない。氏名を auth.users に平文で残さないため。2026-10-28 に「name を渡す」から変更し、既存分は `036` で削除）
3. Supabase の auth.users にレコード作成
4. DB トリガーで profiles テーブルにレコード作成
   - referral_code をランダム生成して付与
5. POST /api/signup/profile を呼び出し、氏名・フリガナ（name_kana）・性別・生年月日・紹介コードを暗号化して profiles に保存
   - フリガナのメイを表示名（nickname）として保存する。ニックネームは表示専用の情報のため暗号化せず平文で保存する（@docs/codingstandards.md 参照）
   - フリガナを送らない古い画面からの登録は、従来どおり nickname を受け付ける（デプロイ直後に開いたままの画面への配慮）
   - 紹介コードがある場合、紹介者を特定し referrals レコードを `status: pending` で作成する（**この時点では 200pt を付与しない**）。報酬確定は被紹介者の初回イベント参加後（下記「紹介コードの処理」参照）
6. /register-complete にリダイレクト
```

### ログイン（/login の SIGN IN タブ）

```
1. ユーザーがメール・パスワードを入力
2. supabase.auth.signInWithPassword() を呼び出す
3. セッションクッキーに保存
4. /home にリダイレクト
```

### ログアウト

```
1. supabase.auth.signOut() を呼び出す
2. / にリダイレクト
```

### パスワードリセット（/login の「パスワードを忘れた」）

```
1. ユーザーがメールアドレスを入力
2. LoginForm.tsx が POST /api/auth/forgot-password を呼び出す（redirectTo: /auth/reset-password）
   - サーバー側で service_role クライアント（src/lib/supabase/service.ts）から
     resetPasswordForEmail() を呼ぶ。@supabase/ssr の createBrowserClient/createServerClient は
     flowType が既定で "pkce" であり、ここから直接呼ぶと発行される token_hash が PKCE の
     code_challenge に紐づいた値（`pkce_` プレフィックス）になり、次段の verifyOtp では検証
     できない（同一端末でも失敗する）。service_role クライアント（@supabase/supabase-js の
     createClient、flowType 既定 "implicit"）を使うことで、verifyOtp と互換性のある通常の
     token_hash を発行させている（src/app/api/auth/forgot-password/route.ts 参照）
3. Supabase からリセットリンク付きメールが送信される
   - メールテンプレート（Supabase Dashboard > Authentication > Email Templates > Reset Password）は
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` を指す（token_hash 方式）。
     本文の HTML は、アプリのメールと同じデザインのものを `supabase/email-templates/reset-password.html` に置いている
     （メールアドレス変更の `change-email.html` も同様。2026-10-27。貼り付け手順は同フォルダの README）
4. ユーザーがリンクをクリック → GET /auth/confirm（route handler）は**検証せず**、
   /auth/verify（確認ページ）へリダイレクトするだけにする
   - メールクライアントやセキュリティスキャナがリンクを先読み（GET）すると、1回限りの
     token_hash が消費されて「リンクが無効です」になる（PC のメールで発生していた）。
     GET では何も消費しないことで、先読みされても本人のクリックが有効なまま残る
   - /auth/verify は「パスワードを再設定する」ボタンだけのページ。ボタンは
     POST /auth/confirm（フォーム送信）で、token_hash・type・next を hidden で渡す
   - POST /auth/confirm が supabase.auth.verifyOtp({ type: "recovery", token_hash }) を
     サーバー側で実行し、Cookie にリカバリーセッションを確立してから
     /auth/reset-password へ 303 リダイレクトする（307 だとブラウザがリダイレクト先へ
     POST を再送するため 303 を使う）
   - PKCE の code_verifier に依存しないため、リセット申請した端末と別の端末・ブラウザで
     メールを開いてもパスワード再設定できる
   - 検証失敗時は /auth/reset-password?error=invalid_link へ。reset-password 画面は
     error 系パラメータと getSession のポーリングで「リンクが無効です」を表示する
   - メールテンプレートのリンク先（`/auth/confirm?token_hash=...&type=recovery`）は変更しない
     ＝送信済みのメールのリンクもそのまま使える
   - ボタンの二重押し・同じリンクの2回開きで、2回目だけが「使用済み」で失敗しないよう、
     ①確認ページのボタンは送信中に無効化（`VerifyForm`）、②POST の検証が失敗しても既にセッションが
     あればそのまま先へ進める（セッションがない使用済みトークンは従来どおり invalid_link）
   - 検証の失敗（`otp_expired` 等）と、再設定メールの送信失敗は、原因を後から調べられるよう
     Sentry に記録する（`tags.area = auth_recovery`。`extra` は `supabaseErrorCode`・`supabaseErrorStatus`・
     `supabaseErrorName`・`supabaseErrorText` のみで、メールアドレスやトークンは含めない）
5. 新パスワードを入力し supabase.auth.updateUser({ password }) を呼び出す
   - 失敗したときは、原因ごとの文言を表示する（`src/lib/passwordUpdateError.ts`）。
     `same_password`（今のパスワードと同じ）・`weak_password`・セッション切れ（リンクの期限切れ）・
     レート制限・その他。以前は原因に関わらず「リンクの有効期限が切れている可能性があります」と
     表示しており、パスワードが今のものと同じ場合もリンクの不具合と誤解されていた
     （2026-09-21 の友人の利用で発覚。BUG-14）。失敗の種類は Sentry にも記録する（`area=auth_recovery`）
6. 同ページ内に再設定完了画面を表示し、「ログイン画面へ」ボタンからリカバリーセッションを signOut() した上で /login へ遷移
```

### メールアドレス変更（マイページ `/mypage` の「メールアドレスを変更する」。2026-10-24 追加）

```
1. ユーザーが新しいメールアドレスと現在のパスワードを入力し、POST /api/account/email を呼ぶ
2. サーバー側で:
   - レート制限（5回/600秒。パスワードの総当たり対策）
   - 形式チェック・今のアドレスと同じなら拒否
   - 現在のパスワードを signInWithPassword で確認（本人以外がログイン中の端末を操作しただけで変更できないように）
   - 同じクライアントの updateUser({ email }) で Supabase に変更を申し込み、確認用のセッションは signOut({ scope: "local" }) で破棄
     （@supabase/supabase-js の createClient、flowType 既定 "implicit"。@supabase/ssr のクライアントから申し込むと
     token_hash が PKCE 用の値になり /auth/confirm で検証できない。BUG-10 と同じ理由）
   - 既に他のアカウントが使っているアドレスは Supabase が拒否する（email_exists）→「このメールアドレスは使用できません」
3. Supabase の Secure email change（オン）により、今のアドレスと新しいアドレスの両方に確認メールが届く
   - メールテンプレート（Supabase Dashboard > Authentication > Email Templates > Change Email Address）は
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` を指す
4. リンク → GET /auth/confirm → /auth/verify（「メールアドレスの変更を確定する」ボタン）→ POST /auth/confirm が
   verifyOtp({ type: "email_change" }) を実行し、/auth/email-change（ログイン不要）へ 303
   - 1通目の確認ではセッションが返らない → status=pending（「もう1通のメールも確認してください」）
   - 2通目の確認でセッションが返り、メールアドレスが切り替わる → status=done。この時点から新しいアドレスでログインする
   - 検証失敗 → status=invalid（Sentry に area=auth_email_change で記録。メールアドレス・トークンは含めない）
```

他人のアカウントの乗っ取り・悪用への対策：既に使われているアドレスには変更できない（Supabase の一意制約）。他人のまだ登録されていないアドレスに変えようとしても、その受信箱のリンクを押さない限り切り替わらない。パスワードを盗まれても、今のアドレスの確認メールのリンクを押さない限り切り替わらない。メールアドレスは `auth.users` のみに保存しており、管理画面の参加者一覧・CSV も `auth.users` から読むため、切り替え後は自動で新しいアドレスになる。

---

### アカウント削除（マイページ `/mypage` の「退会」）

```
1. ユーザーが下ナビの「マイページ」を開き「退会」を押す（2026-10-16 にヘッダーの設定ドロワーから移設。`SettingsMenu`）
2. 確認ダイアログ（削除内容の説明）→ POST /api/account/delete
3. サーバー側で:
   - is_admin なら 400 で拒否（管理者は運営に連絡してもらう運用）
   - 終了前のイベントの確定予約があれば 400 で拒否（先に予約済みの画面でキャンセルしてもらう。
     キャンセルポリシーどおりの返金を経ずに消えないように）
   - service_role で supabase.auth.admin.deleteUser() を実行し、auth.users を完全に削除する
4. クライアント側で supabase.auth.signOut() → / へリダイレクト
```

2026-10-27、依頼者の指定で「匿名化して残す」から「完全に削除する」に変更した。`auth.users` の削除で `profiles` と、そこから `on delete cascade` の `points_log`・`user_badges`・`referrals`・`support_messages`・`event_waitlist`・`journals` 等が連鎖して消える。**予約（＝支払いの記録）だけは残す**：`bookings.user_id` は `on delete set null`（`035_retain_booking_records.sql`）のため、誰の予約か分からない形で、イベント名・日時・金額・決済 ID とともに残る。紹介者側の紹介実績・バッジは、`referrals` の行が消えるため数から減る。

## セッション管理

- Supabase Auth のセッションはクッキーで管理
- `src/lib/supabase/server.ts` でサーバー側のセッションを取得
- `src/lib/supabase/client.ts` でクライアント側のセッションを取得

---

## 認証が必要なページ

| ページ | 未認証時の挙動 |
|--------|-------------|
| `/home` | `/login` にリダイレクト |
| `/impact` | `/login` にリダイレクト |
| `/bookings` | `/login` にリダイレクト |
| `/checkin` | `/login` にリダイレクト |
| `/mypage` | `/login` にリダイレクト |
| `/support` | `/login` にリダイレクト |
| `/events/[id]` | `/login` にリダイレクト（イベント詳細も認証必須。一覧 `/events` 自体は未認証でも閲覧できる） |
| `/events/[id]/checkout` | `/login` にリダイレクト |
| `/admin/*` | 未認証は `/login` へ、認証済みでも `is_admin` でなければ `/home` へリダイレクト |

認証チェックは各 Server Component の先頭で行う：

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

`/admin/*` は `src/app/admin/layout.tsx` で上記に加えて `isAdmin()`（`src/lib/admin.ts`）を確認し、管理者でなければ `/home` へリダイレクトする。API Routes（`/api/admin/*`）は layout の恩恵を受けないため、各ルートの冒頭で同じ認証・管理者チェックを個別に行う。

### 認証済みユーザーがログイン画面にアクセスした場合

`/login` は `src/app/login/page.tsx`（Server Component）の先頭でセッションを確認し、認証済みなら `/home` へリダイレクトする（未認証時のみ `LoginForm`（Client Component）を描画する）。これにより、ログイン後にブラウザの「戻る」で `/login` に戻っても、ログインフォームが再表示されずに `/home` へ即座に戻る。

`/register-complete`（サインアップ直後、認証済み状態で表示される完了画面）や `/auth/reset-password`（リカバリーセッションも `auth.getUser()` 上は認証済み扱いになる）には、この「認証済みなら弾く」ガードは適用しない。前者は認証済みであることが前提の画面であり、後者はパスワード再設定リンクを開いた直後の一時セッションを弾いてしまうと再設定自体ができなくなるため。

---

## 管理者判定

- `profiles.is_admin`（boolean、既定値 `false`）で管理者を判定する。付与するUIは無く、Supabase Studio の SQL Editor から手動で行う運用：
  ```sql
  update public.profiles set is_admin = true where id = '<対象ユーザーのuuid>';
  ```
- `profiles` の既存 UPDATE ポリシー（本人のみ）は行単位の制御のみで列を制限していないため、`is_admin` を保護しないと本人が自分の行を書き換えて管理者に昇格できてしまう。これを防ぐため、`authenticated`/`anon` ロール（＝通常のアプリ経由の更新）からの `is_admin` 変更を無効化するトリガー（`prevent_is_admin_self_update`）を設けている（`supabase/migrations/020_admin_role.sql`）。service_role・Studio からの手動更新は対象外。
- RLS ポリシーからは `public.is_admin()`（SECURITY DEFINER 関数）経由で判定する。

---

## Row Level Security（RLS）方針

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| profiles | 本人のみ／管理者は全件（`032_security_hardening.sql`） | 不可（トリガー） | 不可（2026-10-28〜29、`036_lock_profile_updates.sql`・`037_revoke_profile_updates.sql`。`anon`・`authenticated` からは UPDATE/INSERT/DELETE の権限そのものを外している。以前は本人のみ可で、`rank_level`・カード列などを本人が書き換えられた。ニックネーム変更・新規登録のプロフィール保存・ランクアップのお知らせの既読化・カードの保存は、本人確認済みの API が service_role で行う。新規登録のプロフィール保存は、性別が未登録のとき（登録直後）の1回だけ） | 不可 |
| events | 全員（公開済みのみ）／管理者は全ステータス | 管理者のみ | 管理者のみ | 管理者のみ（2026-10-27 から物理削除。予約は `event_id` が null になって残る） |
| event_options | 全員（親イベントが公開済みのもの）／管理者は全件 | 管理者のみ | 管理者のみ | 管理者のみ |
| bookings | 本人のみ／管理者は全件 | 不可（予約の作成は決済 API が本人確認・残席・決済の上 service_role で行う。本人に許すと決済を通さず「支払い済み」の予約を作れてしまうため。`032_security_hardening.sql`） | 不可（チェックインの `checked_in_at` 更新は `/api/bookings/[id]/checkin` が本人確認＋時間ゲートの上 service_role で行う。キャンセルも同様） | 不可 |
| points_log | 本人のみ | 不可（`src/lib/points.ts` が service_role で記録。本人に許すと参加ポイントの記録を消して再付与させられるため。`032`） | 不可 | 不可（取り消しも service_role） |
| journals（機能停止中） | 本人のみ | 不可 | 不可 | 不可 |
| badges | 全員 | 不可 | 不可 | 不可 |
| user_badges | 本人のみ | サーバーのみ | 不可 | 不可 |
| support_messages | 本人のスレッドのみ／管理者は全件 | 不可（API が service_role で書く） | 不可（既読化も API・ページが service_role で行う） | 不可 |
| event_waitlist | 本人のみ／管理者は全件 | 不可（`/api/events/[id]/waitlist` が service_role で書く） | 不可 | 不可（取り消し・通知後の削除も service_role） |
| referrals | 本人のみ（Impact の「あなたから広がった幸せの数」の2代目分は、他人の行のため Server Component が service_role で件数だけを数える。個々の行・氏名は画面に返さない） | サーバーのみ | サーバーのみ | 不可 |

---

## ポイント操作の権限

ポイントは参加費の割引（1pt = 1円）に使えるため、一般ユーザー（anon / authenticated）が直接増減できないようにする（`supabase/migrations/029_lock_points.sql`、2026-09-27）。

- `increment_points` / `decrement_points` / `spend_points`（いずれも SECURITY DEFINER）の実行権限は `service_role` のみ。アプリ側は `src/lib/points.ts` の `pointsRpc` が、呼び出し元のクライアントに関わらず `createServiceClient()` で実行する
- `profiles.points` は、`authenticated` / `anon` からの UPDATE を `trg_prevent_points_self_update` トリガーで無効化する（`is_admin` と同じ方式）。service_role・Studio からの更新は対象外
- `points_log` の記録・取り消しも、`src/lib/points.ts` が `createServiceClient()` で行う（本人は SELECT のみ。`032_security_hardening.sql`、2026-10-21）
- レート制限の `check_rate_limit` も実行権限は `service_role` のみ（`032`。以前は未ログインでも呼べ、他人の枠を使い切らせることができた）
- 新しい SECURITY DEFINER 関数を作るときは、`revoke execute ... from public, anon, authenticated` を必ず併記する（PostgreSQL の既定では PUBLIC に実行権限が付き、PostgREST の RPC から誰でも呼べてしまうため）

## クレジットカード情報の権限（`030_saved_square_card.sql`）

`profiles` の `square_customer_id`・`square_card_id`・`card_brand`・`card_last4`・`card_exp_month`・`card_exp_year` は、本人のみ SELECT 可。UPDATE は本人からは不可（`036`）で、`src/lib/squareCards.ts` が service_role で書く。

- 生の PAN・CVV は保存しないため、これらの列自体は機微情報ではない（下4桁・ブランド・有効期限は PCI DSS 上も暗号化対象外、`docs/codingstandards.md` 参照）
- 保存済みカードで課金する前、古いカードを無効化する前に、Square 側で持ち主を確かめる（Customer の `referenceId` が本人の user_id で、カードがその Customer のもので有効なこと。`isOwnCustomer`・`isOwnCard`・`disableOwnCard`）。以前は本人がこれらの列を他人の ID に書き換えると、他人の保存済みカードで課金したり、他人のカードを無効化したりできた（2026-10-28 のリリース前の権限の確認で発見。悪用の記録なし）
- `profiles` に入っている Customer が本人のものでなければ使わず、新しく作り直す

## 紹介コードの処理

1. `/login?ref=XXXX` のクエリパラメータを取得し、SIGN UP タブを自動選択・紹介コード欄に初期値としてセット
2. サインアップ完了後、POST `/api/signup/profile` で紹介コードを送信
3. サーバー側で紹介者を特定し `referrals` テーブルにレコードを `status: pending` で作成する（この時点では報酬なし）
4. 被紹介者が**初めてイベントにチェックインした時点**で、チェックイン API（`POST /api/bookings/[id]/checkin`）から `checkAndAwardReferralReward`（`src/lib/referrals.ts`、service_role で実行）が次を行う（2026-10-18 に「イベント終了後のホーム画面ロード時」から変更。付与漏れの保険として被紹介者のホーム画面ロード時にも呼ぶ）：
   - 紹介者・被紹介者双方に 200pt を付与（`points_log` reason: `referral_reward` / `referral_joined`、unique 制約で冪等）
   - `referrals.status` を `rewarded`・`rewarded_at` をセット
   - 紹介者の月間紹介バッジ（Bridge Builder 等）を再判定
   - `points_log` の INSERT RLS は「本人のみ」のため紹介者への付与には service_role が必須
