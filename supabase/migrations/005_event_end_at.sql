alter table public.events
  add column end_at timestamptz;

-- ダミー: 既存イベントはすべて開始から90分後を終了時間に設定
update public.events
  set end_at = start_at + interval '90 minutes'
  where end_at is null;
