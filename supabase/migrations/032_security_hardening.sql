-- セキュリティ強化（2026-10-21）。本番 DB の確認で見つかった穴を塞ぐ。
-- 1. ログイン済みの一般ユーザーが、他人の profiles（ニックネーム・ポイント・カードの下4桁・Square の ID 等）を読めた
--    → profiles の SELECT は「本人」と「管理者」だけにする（019 の意図どおり。本番には別名の全件許可ポリシーが残っていた）
-- 2. 一般ユーザーが bookings に「支払い済み・確定」の予約を直接 INSERT でき、決済を通さずに有料イベントを予約できた
--    → 本人の INSERT を許可しない（予約の作成は決済 API が service_role で行う）
-- 3. 一般ユーザーが自分の points_log を INSERT/DELETE でき、参加ポイントの記録を消してホームを開き直すと何度でも再付与された
--    → 本人は SELECT のみ（記録・取り消しは src/lib/points.ts が service_role で行う）
-- 4. 未ログインでも check_rate_limit を呼べ、他人のレート制限の枠を使い切らせることができた
--    → 実行権限を service_role のみにする
-- あわせて、機能停止中の journals と、サーバーだけが書く referrals・user_badges も、本人は SELECT のみに揃える。
-- ポリシー名に依存せず確実に消すため、対象テーブルの既存ポリシーをいったんすべて削除してから作り直す。

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and (
        tablename in ('bookings', 'points_log', 'journals', 'referrals', 'user_badges')
        or (tablename = 'profiles' and cmd in ('SELECT', 'ALL', 'INSERT', 'DELETE'))
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- profiles：本人と管理者だけが読める（UPDATE の「本人のみ」ポリシーは残す。is_admin・points は 020・029 のトリガーで本人から変更不可）
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles"
  on public.profiles for select using (public.is_admin());

-- bookings：本人と管理者が読める。作成・更新・削除は API が service_role で行う
create policy "Users can view own bookings"
  on public.bookings for select using (auth.uid() = user_id);
create policy "Admins can view all bookings"
  on public.bookings for select using (public.is_admin());

-- points_log：本人が読めるだけ
create policy "Users can view own points_log"
  on public.points_log for select using (auth.uid() = user_id);

-- journals（機能停止中）：本人が読めるだけ
create policy "Users can view own journals"
  on public.journals for select using (auth.uid() = user_id);

-- referrals：紹介した本人が読めるだけ（Impact の件数表示用）
create policy "Users can view own referrals"
  on public.referrals for select using (auth.uid() = referrer_id);

-- user_badges：本人が読めるだけ
create policy "Users can view own badges"
  on public.user_badges for select using (auth.uid() = user_id);

-- RLS が有効なことを念のため確認（無効だとポリシーが効かない）
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.points_log enable row level security;
alter table public.journals enable row level security;
alter table public.referrals enable row level security;
alter table public.user_badges enable row level security;

-- check_rate_limit：service_role 専用
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- 適用後の確認用：対象テーブルのポリシー一覧（すべて SELECT、profiles は UPDATE の1件を含む）
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'bookings', 'points_log', 'journals', 'referrals', 'user_badges')
order by tablename, cmd, policyname;
