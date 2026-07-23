-- 既存バッジデータを削除
delete from public.user_badges;
delete from public.badges;

-- badges の condition_type チェック制約を削除（新しい種別に対応）
alter table public.badges
  drop constraint if exists badges_condition_type_check;

-- user_badges に period カラムを追加（存在しない場合のみ）
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'user_badges'
      and column_name  = 'period'
  ) then
    alter table public.user_badges add column period text not null default '';
  end if;
end $$;

-- 既存ユニーク制約を削除して複合制約に変更
alter table public.user_badges
  drop constraint if exists user_badges_user_id_badge_id_key;

alter table public.user_badges
  drop constraint if exists user_badges_user_badge_period_key;

alter table public.user_badges
  add constraint user_badges_user_badge_period_key unique (user_id, badge_id, period);

-- 新バッジ 10 件を挿入
insert into public.badges (name, description, condition_type, condition_value) values
  ('First Step',          '今月初めてイベントに参加',      'monthly_first_event',    1),
  ('Frequent Visitor',    '今月2回イベントに参加',          'monthly_event_count',    2),
  ('Grand Slam',          '今月のイベント全て参加',         'monthly_all_events',     0),
  ('Mindful Starter',     '今月初めてジャーナルを投稿',     'monthly_first_journal',  1),
  ('Daily Logger',        '7日間連続でジャーナルを投稿',    'streak_journal_days',    7),
  ('Reflective Mind',     '今月15回のジャーナルを投稿',     'monthly_journal_half',  50),
  ('Consistency King',    '今月毎日ジャーナルを投稿',       'monthly_journal_all',    0),
  ('Bridge Builder',      '今月友人を1人招待',              'monthly_referral_count', 1),
  ('Community Recruiter', '今月友人を3人招待',              'monthly_referral_count', 3),
  ('Ambassador',          '今月友人を5人招待',              'monthly_referral_count', 5);
