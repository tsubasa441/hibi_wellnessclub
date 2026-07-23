-- バッジ定義を新仕様 9 種に全面置き換え
delete from public.user_badges;
delete from public.badges;

-- 既存の condition_type チェック制約を削除
alter table public.badges
  drop constraint if exists badges_condition_type_check;

-- 新バッジ 9 件を挿入
insert into public.badges (name, description, condition_type, condition_value) values
  ('Running First',        '今月ランニングクラスに初参加',       'monthly_first_running',  1),
  ('Yoga First',           '今月ヨガクラスに初参加',             'monthly_first_yoga',     1),
  ('Training First',       '今月トレーニングクラスに初参加',     'monthly_first_training', 1),
  ('Boxing First',         '今月ボクシングクラスに初参加',       'monthly_first_boxing',   1),
  ('3 Classes',            '今月3回クラスに参加',                'monthly_event_count',    3),
  ('5 Classes',            '今月5回クラスに参加',                'monthly_event_count',    5),
  ('Bridge Builder',       '今月友人を1人招待',                  'monthly_referral_count', 1),
  ('Community Recruiter',  '今月友人を3人招待',                  'monthly_referral_count', 3),
  ('Ambassador',           '今月友人を5人招待',                  'monthly_referral_count', 5);
