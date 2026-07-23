-- unique(user_id, event_id) が status を問わず適用されていたため、
-- 一度キャンセルした予約が残っていると同じイベントに二度と予約できず、
-- Square決済が成功した直後にこの制約違反でINSERTが失敗し、
-- 「課金されたのに予約なし・返金なし」という事故が実機テストで再現した。
-- confirmed な予約同士でのみ重複を禁止するよう、部分ユニークインデックスに置き換える。
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, event_id)'
  loop
    execute format('alter table public.bookings drop constraint %I', con.conname);
  end loop;
end $$;

create unique index if not exists bookings_user_id_event_id_confirmed_idx
  on public.bookings (user_id, event_id)
  where status = 'confirmed';
