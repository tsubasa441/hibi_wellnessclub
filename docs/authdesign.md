# Hibi 認証設計

---

## 認証方式

Supabase Auth を使用。メールアドレス + パスワード認証のみ。

---

## 認証フロー

### 新規登録（/login の SIGN UP タブ）

```
1. ユーザーが名前・メール・パスワード・性別・生年月日・紹介コード（任意）を入力
2. supabase.auth.signUp() を呼び出す（options.data に name のみ渡す）
3. Supabase の auth.users にレコード作成
4. DB トリガーで profiles テーブルにレコード作成
   - referral_code をランダム生成して付与
5. POST /api/signup/profile を呼び出し、性別・生年月日・紹介コードを暗号化して profiles に保存
   - 紹介コードがある場合、紹介者を特定し referrals レコードを作成、双方に 200pt 付与
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
4. ユーザーがメール内のリンクをクリックし /auth/reset-password に遷移（Supabase が一時的なリカバリーセッションを発行）
5. 新パスワードを入力し supabase.auth.updateUser({ password }) を呼び出す
6. /home にリダイレクト
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

認証チェックは各 Server Component の先頭で行う：

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

---

## Row Level Security（RLS）方針

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| profiles | 本人のみ | 不可（トリガー） | 本人のみ | 不可 |
| events | 全員 | 管理者のみ | 管理者のみ | 管理者のみ |
| bookings | 本人のみ | 本人のみ | 不可 | 不可 |
| badges | 全員 | 不可 | 不可 | 不可 |
| user_badges | 本人のみ | サーバーのみ | 不可 | 不可 |
| referrals | 本人のみ | サーバーのみ | サーバーのみ | 不可 |

---

## 紹介コードの処理

1. `/login?ref=XXXX` のクエリパラメータを取得し、SIGN UP タブを自動選択・紹介コード欄に初期値としてセット
2. サインアップ完了後、POST `/api/signup/profile` で紹介コードを送信
3. サーバー側で紹介者を特定し `referrals` テーブルにレコード作成、紹介者・被紹介者双方に 200pt を即時付与（`referrals.status` を `rewarded` に更新）
