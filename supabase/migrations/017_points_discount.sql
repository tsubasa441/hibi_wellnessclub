-- ポイントを予約時の割引に使えるようにする（1pt = 1円、参加費全額まで）。
-- 返金時に「実際に請求した金額」と「充当ポイント数」を正しく把握できるよう、
-- bookings に amount_charged / points_used を追加する。
-- amount_charged は events.price の後追い変更（価格改定）に影響されない、
-- 予約確定時点の実請求額のスナップショットとして扱う。
alter table public.bookings
  add column points_used integer not null default 0,
  add column amount_charged integer not null default 0;

update public.bookings b
set amount_charged = coalesce(e.price, 0)
from public.events e
where b.event_id = e.id;

-- ポイント残高を超えて使用できないよう、残高チェックと減算を1回のUPDATEで原子的に行う。
-- 残高不足で更新行が0件だった場合は false を返し、呼び出し側で「残高不足」として扱う。
create or replace function spend_points(uid uuid, amount integer)
returns boolean as $$
declare
  affected integer;
begin
  update public.profiles set points = points - amount
  where id = uid and points >= amount;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$ language plpgsql security definer;
