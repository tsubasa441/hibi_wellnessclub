create or replace function decrement_points(uid uuid, amount integer)
returns void as $$
  update public.profiles set points = greatest(0, points - amount) where id = uid;
$$ language sql security definer;
