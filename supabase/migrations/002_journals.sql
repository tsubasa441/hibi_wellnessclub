create table public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  recorded_at date not null default current_date,
  mood text not null check (mood in ('great','good','neutral','low','bad')),
  energy text not null check (energy in ('high','good','neutral','tired','unwell')),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, recorded_at)
);

alter table public.journals enable row level security;

create policy "Users can view own journals"
  on public.journals for select using (auth.uid() = user_id);

create policy "Users can insert own journals"
  on public.journals for insert with check (auth.uid() = user_id);

create policy "Users can update own journals"
  on public.journals for update using (auth.uid() = user_id);
