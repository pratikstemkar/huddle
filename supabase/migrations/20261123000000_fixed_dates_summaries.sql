-- Fixed dates, and a per-trip summary for the home screen.
--
-- 1. An organiser who already knows when the trip is can set the dates instead of letting the group
--    vote. The trip still locks later (it needs a place); locking prefills these dates.
--    Everywhere the app talks about "the trip's dates" it means coalesce(locked, fixed).
-- 2. trip_summaries() gives the home screen the numbers behind each trip card's chip and Pip line.

alter table public.trips
  add column fixed_start date,
  add column fixed_end date,
  add constraint trips_fixed_dates_check check (
    (fixed_start is null) = (fixed_end is null) and (fixed_start is null or fixed_end >= fixed_start)
  );

-- Numbers only, never names, for every trip I'm in. Security definer because a trip that hides who
-- marked which day hides other people's availability rows from me (same as marked_member_count()).
create function public.trip_summaries()
returns table (trip_id uuid, members int, marked int, i_marked boolean, voters int, i_voted boolean, places int)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    (select count(*)::int from trip_members m where m.trip_id = t.id),
    (select count(distinct a.user_id)::int from availability a where a.trip_id = t.id),
    exists (select 1 from availability a where a.trip_id = t.id and a.user_id = auth.uid()),
    (select count(distinct v.user_id)::int from votes v where v.trip_id = t.id),
    exists (select 1 from votes v where v.trip_id = t.id and v.user_id = auth.uid()),
    (select count(*)::int from destinations d where d.trip_id = t.id)
  from trip_members me
  join trips t on t.id = me.trip_id
  where me.user_id = auth.uid();
$$;

revoke all on function public.trip_summaries() from public, anon;
grant execute on function public.trip_summaries() to authenticated;
