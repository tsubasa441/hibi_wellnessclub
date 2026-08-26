-- ニックネーム機能：ユーザーがUI画面で見る表示名を、暗号化された本名（name/name_roman）
-- とは別に持たせる。ニックネームは本人が公開を意図した表示名であり、氏名・性別・生年月日
-- のような機微な個人情報とは性質が異なるため、encrypt.ts による暗号化の対象にはしない。
alter table public.profiles
  add column nickname text not null default '';

alter table public.profiles
  add constraint nickname_length_check check (char_length(nickname) <= 20);

-- 紹介履歴表示用の関数が返す氏名を、暗号化されたnameからニックネームに変更する
-- （呼び出し側で復号が不要になる）。戻り値の列構成が変わるため create or replace では
-- 置き換えられず、先に drop する
drop function if exists public.get_my_referred_names();

-- ニックネーム未設定（空文字）の既存ユーザーとの互換のため、暗号化済みnameも
-- 合わせて返し、呼び出し側で「ニックネームがあればそちらを優先」させる
create function public.get_my_referred_names()
returns table (referee_id uuid, nickname text, name text)
language sql
security definer
set search_path = public
stable
as $$
  select r.referee_id, p.nickname, p.name
  from public.referrals r
  join public.profiles p on p.id = r.referee_id
  where r.referrer_id = auth.uid();
$$;

grant execute on function public.get_my_referred_names() to authenticated;
