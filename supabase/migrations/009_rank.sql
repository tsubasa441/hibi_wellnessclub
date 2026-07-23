alter table public.profiles
  add column rank_level integer not null default 1,
  add column rank_inactive_penalty boolean not null default false;
