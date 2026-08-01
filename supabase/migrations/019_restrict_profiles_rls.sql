-- profiles は本人のみ SELECT 可能に制限する（docs/authdesign.md の RLS 方針に合わせる）
-- これまで "using (true)" で全ユーザーの氏名（暗号化済み）・ポイント・紹介コード等が
-- 誰でも閲覧可能な状態だったため修正する
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

-- user_badges も本人のみ SELECT 可能に制限する（docs/authdesign.md の RLS 方針に合わせる）
drop policy if exists "User badges are viewable by everyone" on public.user_badges;

create policy "Users can view own badges"
  on public.user_badges for select using (auth.uid() = user_id);

-- サインアップ時（未認証）に紹介コードの存在だけを確認するための限定関数
-- プロフィール本体は一切返さない
create or replace function public.referral_code_exists(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles where referral_code = p_code);
$$;

grant execute on function public.referral_code_exists(text) to anon, authenticated;

-- 紹介履歴表示用: 自分が紹介した相手の氏名のみを返す限定関数
create or replace function public.get_my_referred_names()
returns table (referee_id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select r.referee_id, p.name
  from public.referrals r
  join public.profiles p on p.id = r.referee_id
  where r.referrer_id = auth.uid();
$$;

grant execute on function public.get_my_referred_names() to authenticated;
