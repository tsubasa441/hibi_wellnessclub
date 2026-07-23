-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  avatar_url text,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  points integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null check (event_type in ('yoga','training','running','boxing')),
  start_at timestamptz not null,
  location text not null,
  capacity integer not null default 20,
  price integer not null default 0,
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Published events are viewable by everyone"
  on public.events for select using (status = 'published');

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  payment_method text check (payment_method in ('square','paypay','free')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded')),
  payment_id text,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table public.bookings enable row level security;

create policy "Users can view own bookings"
  on public.bookings for select using (auth.uid() = user_id);

create policy "Users can insert own bookings"
  on public.bookings for insert with check (auth.uid() = user_id);

-- Badges
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  condition_type text not null check (condition_type in ('participation_count','referral_count','streak_weeks')),
  condition_value integer not null,
  icon_url text
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_id uuid references public.badges(id) on delete cascade not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "User badges are viewable by everyone"
  on public.user_badges for select using (true);

-- Referrals
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) on delete cascade not null,
  referee_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending','rewarded')),
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referrer_id, referee_id)
);

alter table public.referrals enable row level security;

create policy "Users can view own referrals"
  on public.referrals for select using (auth.uid() = referrer_id);

-- Seed badges
insert into public.badges (name, description, condition_type, condition_value) values
  ('はじめの一歩', '初めて参加した', 'participation_count', 1),
  ('10回達成', '累計10回参加', 'participation_count', 10),
  ('25回達成', '累計25回参加', 'participation_count', 25),
  ('50回達成', '累計50回参加', 'participation_count', 50),
  ('紹介マスター', '3人を紹介した', 'referral_count', 3),
  ('4週連続', '4週連続参加', 'streak_weeks', 4);

-- Function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
