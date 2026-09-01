# Hibi 認証設計

---

## 認証方式

Supabase Auth を使用。メールアドレス + パスワード認証のみ。

---

## 認証フロー

### 新規登録（/login の SIGN UP タブ）

```
1. ユーザーが名前・ニックネーム・メール・パスワード・性別・生年月日・紹介コード（任意）を入力
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
2. supabase.auth.resetPasswordForEmail() を呼び出す（redirectTo: /auth/reset-password）
3. Supabase からリセットリンク付きメールが送信される
   - メールテンプレート（Supabase Dashboard > Authentication > Email Templates > Reset Password）は
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` を指す（token_hash 方式）
4. ユーザーがリンクをクリック → GET /auth/confirm（route handler）が
   supabase.auth.verifyOtp({ type: "recovery", token_hash }) をサーバー側で実行し、
   Cookie にリカバリーセッションを確立してから /auth/reset-password へリダイレクトする
   - PKCE の code_verifier に依存しないため、リセット申請した端末と別の端末・ブラウザで
     メールを開いてもパスワード再設定できる（@supabase/ssr の createBrowserClient は
     flowType を pkce に固定するため、`?code=` 方式だと別端末で verifier が無く失敗する）
   - 検証失敗時は /auth/reset-password?error=invalid_link へ。reset-password 画面は
     error 系パラメータと getSession のポーリングで「リンクが無効です」を表示する
5. 新パスワードを入力し supabase.auth.updateUser({ password }) を呼び出す
6. 同ページ内に再設定完了画面を表示し、「ログイン画面へ」ボタンからリカバリーセッションを signOut() した上で /login へ遷移
```

---

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
