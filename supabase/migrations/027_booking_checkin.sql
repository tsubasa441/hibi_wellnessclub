-- イベントのチェックイン機能。
-- ユーザーは予約済み画面から「イベント開始時刻〜終了時刻」の間だけチェックインでき、
-- チェックインを参加の唯一の条件とする（参加ポイント・月間ボーナス・クラスバッジ・
-- ランクの累計参加回数はチェックイン済みの予約のみでカウントされる）。
-- 書き込みは API ルートが service_role で行うため RLS ポリシーは追加しない。

alter table public.bookings
  add column checked_in_at timestamptz;

-- チェックイン機能の導入前に既に終了しているイベントの確定予約は「参加済み」として扱う。
-- 既存ユーザーの累計参加回数・ポイント履歴を変えないための後方互換措置。
update public.bookings b
set checked_in_at = e.start_at
from public.events e
where b.event_id = e.id
  and b.status = 'confirmed'
  and b.checked_in_at is null
  and e.start_at + interval '2 hours' <= now();
