create table public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  reference_id text not null,
  points integer not null,
  created_at timestamptz not null default now()
);

-- 同じユーザー・理由・参照IDで重複付与しない
create unique index points_log_unique on public.points_log (user_id, reason, reference_id);

alter table public.points_log enable row level security;

create policy "users can read own points_log"
  on public.points_log for select
  using (auth.uid() = user_id);

create policy "users can insert own points_log"
  on public.points_log for insert
  with check (auth.uid() = user_id);
