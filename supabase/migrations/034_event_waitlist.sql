-- イベントのキャンセル待ち（2026-10-25）。満席のイベントに登録しておくと、空きが出たときにメールで知らせる。
-- 通知したら行を削除する（1回の登録につき通知は1回。予約しそびれたら本人がもう一度登録する）。
-- 書き込みは API（/api/events/[id]/waitlist、src/lib/waitlist.ts）が本人確認のうえ service_role で行う
create table if not exists public.event_waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_waitlist enable row level security;

drop policy if exists "event_waitlist_select_own" on public.event_waitlist;
create policy "event_waitlist_select_own" on public.event_waitlist
  for select using (auth.uid() = user_id);

drop policy if exists "event_waitlist_select_admin" on public.event_waitlist;
create policy "event_waitlist_select_admin" on public.event_waitlist
  for select using (public.is_admin());
