alter table public.profiles
  add column gender text check (gender in ('male', 'female', 'other')),
  add column birth_date date,
  add column referral_code_used text;
