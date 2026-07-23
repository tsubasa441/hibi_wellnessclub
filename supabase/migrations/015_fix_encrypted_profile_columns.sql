-- gender / birth_date は個人情報のため暗号化した文字列として保存する仕様だが、
-- 004_profile_fields.sql では平文入力を前提にした date 型・CHECK 制約のままだったため、
-- signup/profile API での UPDATE が型エラー・制約違反で失敗していた（新規登録時の 500 エラーの原因）。

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%gender%'
  loop
    execute format('alter table public.profiles drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.profiles
  alter column birth_date type text using birth_date::text;
