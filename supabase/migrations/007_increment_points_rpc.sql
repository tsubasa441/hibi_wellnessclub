create or replace function increment_points(uid uuid, amount integer)
returns void as $$
  update public.profiles set points = points + amount where id = uid;
$$ language sql security definer;
