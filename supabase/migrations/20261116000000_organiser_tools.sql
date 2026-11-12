-- Organisers can fix mistakes: unlock a trip to re-plan it, and remove a member.

-- Unlocking puts the trip back into planning. Everyone's days, places and votes are kept.
create function public.unlock_trip(t uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organiser(t) then
    raise exception 'Only the organiser can unlock the trip' using errcode = '42501';
  end if;
  if not is_locked(t) then
    raise exception 'This trip is not locked' using errcode = 'P0001';
  end if;
  update trips
     set status = 'planning', locked_start = null, locked_end = null,
         locked_destination_id = null, updated_at = now()
   where id = t;
end $$;

-- Organisers remove members (never other organisers). The existing triggers clear the removed
-- person's days and votes.
create policy "organisers remove members" on public.trip_members for delete
  using (role = 'member' and public.is_organiser(trip_id));
