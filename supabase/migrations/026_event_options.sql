-- イベントごとの「選択項目」機能。
-- 管理者がイベントに任意個数の質問（プルダウンで選ばせる項目）を設定でき、
-- ユーザーはイベント詳細画面で回答してから予約する。回答は金額・ポイント・
-- 返金には一切影響しない（無料の情報項目）。管理者は参加者一覧・CSV で確認する。

create table public.event_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  choices jsonb not null default '[]'::jsonb,
  multi_select boolean not null default false,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index event_options_event_id_idx on public.event_options(event_id);

alter table public.event_options enable row level security;

-- SELECT 方針は events に合わせる：公開イベントの選択項目は誰でも閲覧可、
-- 管理者はステータス問わず閲覧可（020_admin_role.sql の is_admin() を再利用）
create policy "Event options viewable with published event"
  on public.event_options for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
    or public.is_admin()
  );

create policy "Admins can insert event options"
  on public.event_options for insert
  with check (public.is_admin());

create policy "Admins can update event options"
  on public.event_options for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete event options"
  on public.event_options for delete
  using (public.is_admin());

-- 予約時のユーザーの回答をスナップショットで保持する。
-- 形: [{ "option_id": "<uuid>", "label": "<回答時点のラベル>", "values": ["M"] }]
-- スナップショットにすることで、参加者一覧・CSV が join 無しで読め、
-- 管理者が後から選択項目を編集・削除しても既存予約の回答が保持される。
alter table public.bookings
  add column option_selections jsonb not null default '[]'::jsonb;
