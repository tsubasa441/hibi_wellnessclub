-- イベント種別にピラティスを追加する
alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in ('yoga', 'training', 'running', 'boxing', 'pilates'));

-- 月間バッジ「Pilates First」を追加する（他の種別の「〜 First」バッジと同様）
insert into public.badges (name, description, condition_type, condition_value)
values ('Pilates First', '今月ピラティスクラスに初参加', 'monthly_first_pilates', 1);
