alter table public.points_log
  add column expires_at timestamptz,
  add column deducted boolean not null default false;
