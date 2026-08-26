-- 定員超過の予約を防ぐDB側の安全策。
-- アプリ側の残席チェックは「SELECT件数→比較→INSERT」の2ステップで行っており、
-- 同時に複数リクエストが届くと両方とも「空きあり」と判定してINSERTしてしまう
-- TOCTOU競合が起こり得る（testplan.md 4-8で実際に再現：定員1のイベントに
-- 2ユーザーが同時予約し、確定予約が2件作られることを確認）。
-- events 行をロックしてから残席を数えることで、同一イベントへの同時INSERTを
-- 直列化し、定員を超えるconfirmed予約が作られないようにする。
create or replace function public.check_booking_capacity()
returns trigger as $$
declare
  v_capacity integer;
  v_confirmed_count integer;
begin
  if new.status is distinct from 'confirmed' then
    return new;
  end if;

  select capacity into v_capacity
  from public.events
  where id = new.event_id
  for update;

  if v_capacity is null then
    return new;
  end if;

  select count(*) into v_confirmed_count
  from public.bookings
  where event_id = new.event_id and status = 'confirmed';

  if v_confirmed_count >= v_capacity then
    raise exception 'イベントは満席です' using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists bookings_check_capacity on public.bookings;

create trigger bookings_check_capacity
before insert on public.bookings
for each row execute function public.check_booking_capacity();
