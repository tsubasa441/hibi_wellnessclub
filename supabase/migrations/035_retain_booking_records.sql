-- 退会したユーザー・削除したイベントのデータは残さず、予約・支払いの記録だけを残す（2026-10-27、依頼者の指定）。
-- これまで bookings は profiles / events の削除に連動して消えていた（on delete cascade）。
-- 売上の記録として予約は残すため、削除時は user_id / event_id を null にする（on delete set null）。
-- イベントを消したあとも、参加回数・参加ポイント・バッジの判定と売上の記録に必要な情報が分かるよう、
-- イベント名・開催日時・種別を予約に書き写しておく（イベントがある間はイベントの変更に合わせて更新する）。

-- 1. 書き写す列
alter table public.bookings add column if not exists event_title text;
alter table public.bookings add column if not exists event_start_at timestamptz;
alter table public.bookings add column if not exists event_end_at timestamptz;
alter table public.bookings add column if not exists event_type text;

update public.bookings b
set event_title = e.title,
    event_start_at = e.start_at,
    event_end_at = e.end_at,
    event_type = e.event_type
from public.events e
where b.event_id = e.id;

-- 2. 予約を作るときに書き写す
create or replace function public.copy_event_snapshot_to_booking()
returns trigger as $$
begin
  if new.event_id is not null then
    select title, start_at, end_at, event_type
      into new.event_title, new.event_start_at, new.event_end_at, new.event_type
    from public.events where id = new.event_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.copy_event_snapshot_to_booking() from public, anon, authenticated;

drop trigger if exists bookings_copy_event_snapshot on public.bookings;
create trigger bookings_copy_event_snapshot
  before insert on public.bookings
  for each row execute function public.copy_event_snapshot_to_booking();

-- 3. イベントが編集されたら（開催日時の変更など）、そのイベントの予約の書き写しも更新する
create or replace function public.sync_event_snapshot_to_bookings()
returns trigger as $$
begin
  if new.title is distinct from old.title
     or new.start_at is distinct from old.start_at
     or new.end_at is distinct from old.end_at
     or new.event_type is distinct from old.event_type then
    update public.bookings
    set event_title = new.title,
        event_start_at = new.start_at,
        event_end_at = new.end_at,
        event_type = new.event_type
    where event_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.sync_event_snapshot_to_bookings() from public, anon, authenticated;

drop trigger if exists events_sync_snapshot_to_bookings on public.events;
create trigger events_sync_snapshot_to_bookings
  after update on public.events
  for each row execute function public.sync_event_snapshot_to_bookings();

-- 4. ユーザー・イベントを消しても予約は残す（null にする）
alter table public.bookings alter column user_id drop not null;
alter table public.bookings alter column event_id drop not null;

do $$
declare
  c record;
begin
  for c in
    select con.conname, att.attname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.bookings'::regclass
      and con.contype = 'f'
      and att.attname in ('user_id', 'event_id')
  loop
    execute format('alter table public.bookings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.bookings
  add constraint bookings_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.bookings
  add constraint bookings_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
