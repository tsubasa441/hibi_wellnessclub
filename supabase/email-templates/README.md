# Supabase のメールテンプレート

パスワード再設定・メールアドレス変更のメールは Supabase Auth が送るため、文面とデザインは Supabase の管理画面のテンプレートで設定する。アプリが送るメール（`src/lib/email.ts`）と同じデザインにするため、ここに HTML を置いている（2026-10-27）。`src/lib/email.ts` の `emailLayout` を変えたときは、こちらも同じように直して管理画面に貼り直す。

| ファイル | 管理画面のテンプレート | 件名の例 |
|---------|----------------------|---------|
| `reset-password.html` | Authentication → Emails（Email Templates）→ Reset Password | 【Hibi】パスワードの再設定 |
| `change-email.html` | Authentication → Emails（Email Templates）→ Change Email Address | 【Hibi】メールアドレスの変更について |

`reset-password.html` のリンク先は `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` のまま変えないこと（`docs/authdesign.md` 参照）。

**`change-email.html` には `{{ .TokenHash }}`・`{{ .Token }}`・`{{ .ConfirmationURL }}` を入れないこと。** このメールは、Hibi の API を通さず Supabase に直接変更を申し込んだときにだけ送られる。確定に使える値を載せると、今のアドレスの確認を飛ばして変更できてしまう（2026-11-01。アプリの変更手続きのメールは `src/lib/email.ts` から送る）。

ロゴ画像とフッターのリンクも `{{ .SiteURL }}` を使うため、Supabase の Site URL が本番ドメイン（`https://hibi-wellnessclub.jp`）になっている必要がある。
