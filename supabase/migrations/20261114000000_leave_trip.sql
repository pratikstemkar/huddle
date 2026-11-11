-- Leaving a trip.
-- 1. The last organiser can't leave: nobody could manage the trip afterwards. They delete it instead.
-- 2. Leaving clears your free days and votes, so you stop counting in the overlap and vote totals.
--    Places you suggested stay.

create function public.guard_leave_trip() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- When the trip itself is being deleted its row is already gone, so everyone can go.
  if old.role = 'organiser'
     and exists (select 1 from trips where id = old.trip_id)
     and not exists (
       select 1 from trip_members
       where trip_id = old.trip_id and role = 'organiser' and user_id <> old.user_id
     ) then
    raise exception 'The last organiser cannot leave the trip' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger trip_members_guard_leave
  before delete on public.trip_members
  for each row execute function public.guard_leave_trip();

create function public.clear_leaver_data() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from availability where trip_id = old.trip_id and user_id = old.user_id;
  delete from votes where trip_id = old.trip_id and user_id = old.user_id;
  return old;
end $$;

create trigger trip_members_clear_data
  after delete on public.trip_members
  for each row execute function public.clear_leaver_data();
