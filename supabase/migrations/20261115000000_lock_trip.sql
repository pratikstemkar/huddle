-- Locking a trip: the organiser picks the dates and the destination, and the plan stops changing.

create function public.is_locked(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and status = 'locked');
$$;

create function public.lock_trip(t uuid, start_day date, end_day date, destination uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organiser(t) then
    raise exception 'Only the organiser can lock the trip' using errcode = '42501';
  end if;
  if is_locked(t) then
    raise exception 'This trip is already locked' using errcode = 'P0001';
  end if;
  if start_day is null or end_day is null or start_day > end_day then
    raise exception 'The end date must not be before the start date' using errcode = 'P0001';
  end if;
  if not exists (select 1 from destinations where id = destination and trip_id = t) then
    raise exception 'That destination is not part of this trip' using errcode = 'P0001';
  end if;
  update trips
     set status = 'locked', locked_start = start_day, locked_end = end_day,
         locked_destination_id = destination, updated_at = now()
   where id = t;
end $$;

-- Once locked, nobody adds days, places or votes, and the chosen place can't be deleted.
drop policy "mark own availability" on public.availability;
create policy "mark own availability" on public.availability for insert
  with check (user_id = auth.uid() and public.is_member(trip_id) and not public.is_locked(trip_id));

drop policy "members add destinations" on public.destinations;
create policy "members add destinations" on public.destinations for insert
  with check (created_by = auth.uid() and public.is_member(trip_id) and not public.is_locked(trip_id));

drop policy "remove own destinations" on public.destinations;
create policy "remove own destinations" on public.destinations for delete
  using ((created_by = auth.uid() or public.is_organiser(trip_id)) and not public.is_locked(trip_id));

drop policy "cast own vote" on public.votes;
create policy "cast own vote" on public.votes for insert with check (
  user_id = auth.uid()
  and public.is_member(trip_id)
  and not public.is_locked(trip_id)
  and exists (select 1 from destinations d where d.id = destination_id and d.trip_id = votes.trip_id)
);
