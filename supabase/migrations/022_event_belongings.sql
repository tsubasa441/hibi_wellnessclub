-- イベントに持ち物設定（参加者が持参すべき物の自由記述欄）を追加する。任意項目。
alter table public.events
  add column belongings text;
