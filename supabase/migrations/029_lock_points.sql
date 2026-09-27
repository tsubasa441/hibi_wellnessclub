-- ポイントを一般ユーザー（anon / authenticated）から操作できないようにする。
--
-- 問題1: increment_points / decrement_points / spend_points は SECURITY DEFINER だが、
--   実行権限を絞っていなかったため、未ログインでも PostgREST の RPC 経由で任意の uid の
--   ポイントを増減・消費できた（他人のポイントの改ざん、参加費の不正な割引につながる）。
--   実行権限を service_role のみにする（アプリ側は src/lib/points.ts の pointsRpc で service_role から呼ぶ）。
--
-- 問題2: profiles の "Users can update own profile" は行単位の制御のみで列を制限していないため、
--   本人がブラウザから自分の points を直接書き換えられた（is_admin だけは 020 で保護済み）。
--   authenticated / anon からの points の変更を無効化する。service_role・Studio からの更新は対象外。

revoke execute on function public.increment_points(uuid, integer) from public, anon, authenticated;
revoke execute on function public.decrement_points(uuid, integer) from public, anon, authenticated;
revoke execute on function public.spend_points(uuid, integer) from public, anon, authenticated;

grant execute on function public.increment_points(uuid, integer) to service_role;
grant execute on function public.decrement_points(uuid, integer) to service_role;
grant execute on function public.spend_points(uuid, integer) to service_role;

create or replace function public.prevent_points_self_update()
returns trigger
language plpgsql
as $$
begin
  if new.points is distinct from old.points
     and auth.role() in ('authenticated', 'anon') then
    new.points := old.points;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_points_self_update on public.profiles;
create trigger trg_prevent_points_self_update
  before update on public.profiles
  for each row execute procedure public.prevent_points_self_update();
