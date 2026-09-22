# Hibi 認証設計

---

## 認証方式

Supabase Auth を使用。メールアドレス + パスワード認証のみ。

---

## 認証フロー

### 新規登録（/login の SIGN UP タブ）

```
1. ユーザーが名前・ニックネーム・メール・パスワード・性別・生年月日・紹介コード（任意）を入力
   - 「登録」ボタンの直前に「『登録』を押すと、利用規約とプライバシーポリシーに同意したものとみなします」と表示し、`/legal/terms`・`/legal/privacy` へのリンクを置く（入力内容が消えないよう別タブで開く。チェックボックスは設けない）
2. supabase.auth.signUp() を呼び出す（options.data に name のみ渡す）
3. Supabase の auth.users にレコード作成
4. DB トリガーで profiles テーブルにレコード作成
   - referral_code をランダム生成して付与
5. POST /api/signup/profile を呼び出し、性別・生年月日・紹介コードを暗号化して profiles に保存
   - ニックネームは表示専用の情報のため暗号化せず平文で保存する（@docs/codingstandards.md 参照）
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
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` を指す（token_hash 方式）
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
     Sentry に記録する（`tags.area = auth_recovery`。`extra` は `authErrorCode`・`authErrorStatus`・
     `authErrorName`・`authErrorText` のみで、メールアドレスやトークンは含めない）
5. 新パスワードを入力し supabase.auth.updateUser({ password }) を呼び出す
   - 失敗したときは、原因ごとの文言を表示する（`src/lib/passwordUpdateError.ts`）。
     `same_password`（今のパスワードと同じ）・`weak_password`・セッション切れ（リンクの期限切れ）・
     レート制限・その他。以前は原因に関わらず「リンクの有効期限が切れている可能性があります」と
     表示しており、パスワードが今のものと同じ場合もリンクの不具合と誤解されていた
     （2026-09-21 の友人の利用で発覚。BUG-14）。失敗の種類は Sentry にも記録する（`area=auth_recovery`）
6. 同ページ内に再設定完了画面を表示し、「ログイン画面へ」ボタンからリカバリーセッションを signOut() した上で /login へ遷移
```

---

### アカウント削除（/impact の「アカウントを削除する」）

```
1. ユーザーが /impact 下部の「アカウントを削除する」を押す
2. 確認ダイアログ（削除内容の説明）→ POST /api/account/delete
3. サーバー側（service_role）で:
   - is_admin なら 400 で拒否（管理者は運営に連絡してもらう運用）
   - profiles の氏名・ローマ字氏名・ニックネーム・性別・生年月日・使用した紹介コード・
     アバターURLを匿名化（nickname は「退会済みユーザー」に置換、他はnull）
   - auth.users は削除しない（profiles.id が auth.users(id) on delete cascade のため、
     削除すると bookings・journals・referrals 等の履歴も連鎖的に消えてしまう）。
     代わりに supabase.auth.admin.updateUserById() でメールアドレスを
     `deleted-<uuid>@deleted.invalid` に、パスワードをランダム値に置き換え、
     ban_duration（十分に長い期間）でログイン自体を無効化する
4. クライアント側で supabase.auth.signOut() → / へリダイレクト
```

予約・決済・ポイント履歴・紹介関係（`bookings`・`points_log`・`referrals`等）は `user_id` を保持したまま残す。会計上の記録を保つことと、自分が紹介した相手の紹介実績表示（Impact画面）に影響を与えないことが理由。

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
| profiles | 本人のみ | 不可（トリガー） | 本人のみ（`is_admin` 列は本人からの変更を無効化） | 不可 |
| events | 全員（公開済みのみ）／管理者は全ステータス | 管理者のみ | 管理者のみ | 管理者のみ（アプリからは呼ばず論理削除で運用） |
| event_options | 全員（親イベントが公開済みのもの）／管理者は全件 | 管理者のみ | 管理者のみ | 管理者のみ |
| bookings | 本人のみ／管理者は全件 | 本人のみ | 不可（チェックインの `checked_in_at` 更新は `/api/bookings/[id]/checkin` が本人確認＋時間ゲートの上 service_role で行う。キャンセルも同様） | 不可 |
| badges | 全員 | 不可 | 不可 | 不可 |
| user_badges | 本人のみ | サーバーのみ | 不可 | 不可 |
| referrals | 本人のみ | サーバーのみ | サーバーのみ | 不可 |

---

## 紹介コードの処理

1. `/login?ref=XXXX` のクエリパラメータを取得し、SIGN UP タブを自動選択・紹介コード欄に初期値としてセット
2. サインアップ完了後、POST `/api/signup/profile` で紹介コードを送信
3. サーバー側で紹介者を特定し `referrals` テーブルにレコードを `status: pending` で作成する（この時点では報酬なし）
4. 被紹介者が**初回イベントにチェックインし、そのイベントの終了時刻を過ぎた後**、被紹介者のホーム画面ロード時に `checkAndAwardReferralReward`（`src/lib/referrals.ts`、service_role で実行）が：
   - 紹介者・被紹介者双方に 200pt を付与（`points_log` reason: `referral_reward` / `referral_joined`、unique 制約で冪等）
   - `referrals.status` を `rewarded`・`rewarded_at` をセット
   - 紹介者の月間紹介バッジ（Bridge Builder 等）を再判定
   - `points_log` の INSERT RLS は「本人のみ」のため紹介者への付与には service_role が必須
