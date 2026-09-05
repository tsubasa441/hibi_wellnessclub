-- レート制限用テーブル。API Route から service_role 経由の check_rate_limit() のみが
-- 読み書きする内部管理用データのため、authenticated/anon への SELECT/INSERT/UPDATE は許可しない
-- （points_log 等と同様、RLS を有効にしたままポリシーを設けず service_role にのみ操作を許可する）。
create table public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- key ごとに固定長の時間窓（p_window_seconds）内のリクエスト数を数え、上限（p_limit）以内かを返す。
-- INSERT ... ON CONFLICT ... DO UPDATE の1文でカウントの読み取り・更新を行うため、
-- 同一 key への同時リクエストが競合してもカウントが正しく直列化される（行ロックによる原子性）。
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
