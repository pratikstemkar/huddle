-- The day-by-day plan. Each item sits on one of the trip's days, at a time of day.
--
-- "The trip's dates" are the locked dates, else the dates the organiser fixed up front. A trip with
-- neither has no plan yet: inserts and edits are refused until it has dates.
-- Unlocking (or changing the dates) keeps every item; items outside the new dates stay stored and can
-- still be moved onto the new dates or deleted.

-- Whether a day falls inside the trip's dates.
create function public.in_trip_dates(t uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trips
    where id = t and d between coalesce(locked_start, fixed_start) and coalesce(locked_end, fixed_end)
  );
$$;

-- Keeps updated_at honest on tables the app edits in place.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date not null,
  start_time time not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  note text check (note is null or char_length(note) <= 200),
  -- Null once the author deletes their account; their items stay with the trip.
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.itinerary_items (trip_id, day, start_time);
create index on public.itinerary_items (created_by);

create trigger itinerary_items_touch
  before update on public.itinerary_items
  for each row execute function public.touch_updated_at();

alter table public.itinerary_items enable row level security;

create policy "members read plan" on public.itinerary_items for select using (public.is_member(trip_id));

create policy "members add to plan" on public.itinerary_items for insert
  with check (created_by = auth.uid() and public.is_member(trip_id) and public.in_trip_dates(trip_id, day));

-- The author or an organiser edits an item, and only onto the trip's dates.
create policy "edit own plan items" on public.itinerary_items for update
  using (public.is_member(trip_id) and (created_by = auth.uid() or public.is_organiser(trip_id)))
  with check (public.is_member(trip_id) and public.in_trip_dates(trip_id, day));

-- Removing works even off the dates or on a trip without dates, so stranded items can be cleared.
create policy "remove own plan items" on public.itinerary_items for delete
  using (public.is_member(trip_id) and (created_by = auth.uid() or public.is_organiser(trip_id)));

-- Only the content is editable: an item can't move to another trip or change its author.
grant select, insert, delete on public.itinerary_items to authenticated;
revoke update on public.itinerary_items from anon, authenticated;
grant update (day, start_time, title, note) on public.itinerary_items to authenticated;

alter publication supabase_realtime add table public.itinerary_items;
