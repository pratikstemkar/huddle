-- What someone holding an invite code may see before signing in: the trip's name, colour and how many
-- people are in it. Nothing else about the trip or its members. Works for signed-out visitors (anon),
-- so the invite page can say "Join Goa in March" instead of "Join a trip".
-- Returns no row when the code matches nothing.
create function public.invite_preview(code text)
returns table (name text, color text, members int)
language sql stable security definer set search_path = public as $$
  select t.name, t.color, (select count(*)::int from trip_members m where m.trip_id = t.id)
  from trips t
  where t.invite_code = lower(trim(code));
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
