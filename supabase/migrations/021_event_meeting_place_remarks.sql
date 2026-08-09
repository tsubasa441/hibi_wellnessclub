-- イベントに集合場所（開催場所とは別の、具体的な待ち合わせ情報）と
-- 備考（説明文とは別の自由記述欄）を追加する。どちらも任意項目。
alter table public.events
  add column meeting_place text,
  add column remarks text;
