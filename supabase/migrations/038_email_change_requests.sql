-- メールアドレス変更の申し込み（2026-11-01）。今のアドレスに届くリンクが押されるまで、変更を進めない。
-- Supabase の Secure email change は「メール確認なしの登録」の設定では2通目の確認が省かれ、新しいアドレスの
-- リンクだけで切り替わってしまうため、今のアドレスの確認をアプリ側で行う。
-- 1人1件（申し込み直すと置き換わる）。トークンはハッシュ、新しいアドレスは暗号化して保存する。
-- 読み書きは API（/api/account/email）が service_role で行うため、ポリシーは設けない
create table if not exists public.email_change_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.email_change_requests enable row level security;
