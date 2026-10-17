-- お問い合わせチャット（2026-10-17）。
-- ユーザー1人につき運営との1本のスレッド。ユーザーはマイページの「お問い合わせ」から送り、
-- 運営は管理画面（/admin/support）から返信する。新着は双方にメールで通知する（アプリ側）。
-- 書き込みは API が本人確認・管理者確認のうえ service_role で行うため、INSERT/UPDATE/DELETE の
-- ポリシーは作らない（authenticated / anon からは書き込めない）。

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  -- 相手側が読んだ日時。ユーザー宛て（sender = 'admin'）は read_by_user_at、
  -- 運営宛て（sender = 'user'）は read_by_admin_at を使う
  read_by_user_at timestamptz,
  read_by_admin_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_messages_user_created_idx on public.support_messages(user_id, created_at);

alter table public.support_messages enable row level security;

-- 本人は自分のスレッドのみ、管理者は全件を閲覧できる（020_admin_role.sql の is_admin() を再利用）
create policy "Users can view own support messages"
  on public.support_messages for select
  using (auth.uid() = user_id or public.is_admin());
