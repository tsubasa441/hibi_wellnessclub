-- 036 の適用後も、本人が profiles を直接更新できた（2026-10-29 の権限の確認）。本番に 036 で消した名前とは別の
-- UPDATE ポリシーが残っていたか、036 が実行されていなかったとみられる。ポリシーの名前に頼らず、確実に塞ぐ。
--
-- 1. anon / authenticated から profiles の更新・追加・削除の権限そのものを外す（RLS の前に権限で拒否される）。
--    アプリの書き込みはすべて本人確認済みの API から service_role で行う（service_role には影響しない）
-- 2. 名前に関係なく、profiles の UPDATE（と ALL）ポリシーをすべて消す
-- 3. auth.users のメタデータに平文で残っている氏名を消す（036 と同じ。何度実行しても安全）

revoke update, insert, delete on public.profiles from anon, authenticated;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd in ('UPDATE', 'ALL')
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

update auth.users set raw_user_meta_data = raw_user_meta_data - 'name' where raw_user_meta_data ? 'name';

-- 確認用：実行後に下の結果が出る。profiles のポリシーは SELECT だけ、更新の権限は false、氏名の残りは 0 になっていれば OK
select
  (select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies where schemaname = 'public' and tablename = 'profiles') as profiles_policies,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as authenticated_can_update,
  (select count(*) from auth.users where raw_user_meta_data ? 'name') as users_with_name_in_metadata;
