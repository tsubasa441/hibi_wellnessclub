-- 管理者判定用カラム（既定値: 非管理者）
alter table public.profiles
  add column is_admin boolean not null default false;

-- 管理者判定を一箇所に集約する関数（019の referral_code_exists() と同じ設計方針）
-- profiles の SELECT RLS（本人のみ）を経由せず判定できるため、events/bookings のポリシーから安全に呼び出せる
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------
-- is_admin の自己昇格を防止する
-- "Users can update own profile" は行単位の制御のみで列は制限していないため、
-- このカラムを保護しないと本人が自分の is_admin を true に書き換えられてしまう。
-- authenticated/anon ロール（= PostgREST 経由の一般クライアント）からの更新でのみ
-- is_admin の変更を無効化する。service_role や Studio SQL Editor からの手動更新は対象外。
-- ---------------------------------------------------------------
create or replace function public.prevent_is_admin_self_update()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.role() in ('authenticated', 'anon') then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_is_admin_self_update on public.profiles;
create trigger trg_prevent_is_admin_self_update
  before update on public.profiles
  for each row execute procedure public.prevent_is_admin_self_update();

-- ---------------------------------------------------------------
-- events: 管理者はステータス問わず全件 SELECT / INSERT / UPDATE / DELETE 可能
-- （docs/authdesign.md の RLS 方針表の「events: 管理者のみ」を実装）
-- 既存の "Published events are viewable by everyone" は一般ユーザー向けにそのまま残す。
-- ---------------------------------------------------------------
create policy "Admins can view all events"
  on public.events for select
  using (public.is_admin());

create policy "Admins can insert events"
  on public.events for insert
  with check (public.is_admin());

create policy "Admins can update events"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete events"
  on public.events for delete
  using (public.is_admin());

-- ---------------------------------------------------------------
-- bookings: 管理者は参加者管理のため全件 SELECT 可能にする
-- （既存の "Users can view own bookings" はそのまま残す）
-- ---------------------------------------------------------------
create policy "Admins can view all bookings"
  on public.bookings for select
  using (public.is_admin());
