-- Organisers can hide who marked which day. With it off, members see only how many people are free
-- on each day; their own days stay visible to them. The database enforces it, not just the app.

alter table public.trips add column show_who_marked boolean not null default true;

create function public.shows_who_marked(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select show_who_marked from trips where id = t), true);
$$;

drop policy "members read availability" on public.availability;
create policy "members read availability" on public.availability for select using (
  user_id = auth.uid() or (public.is_member(trip_id) and public.shows_who_marked(trip_id))
);

-- How many people are free on each day. Kept up to date by a trigger, readable by every member
-- whatever the setting, and streamed so the heatmap stays live when other people's rows are hidden.
create table public.day_counts (
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date not null,
  free integer not null check (free > 0),
  primary key (trip_id, day)
);

alter table public.day_counts enable row level security;
create policy "members read day counts" on public.day_counts for select using (public.is_member(trip_id));

create function public.track_day_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into day_counts (trip_id, day, free) values (new.trip_id, new.day, 1)
    on conflict (trip_id, day) do update set free = day_counts.free + 1;
    return new;
  end if;
  -- Delete: drop the row when the last person clears the day. During a trip delete the row may
  -- already be gone through the cascade, which is fine.
  delete from day_counts where trip_id = old.trip_id and day = old.day and free <= 1;
  update day_counts set free = free - 1 where trip_id = old.trip_id and day = old.day;
  return old;
end $$;

create trigger availability_track_day_counts
  after insert or delete on public.availability
  for each row execute function public.track_day_counts();

insert into public.day_counts (trip_id, day, free)
select trip_id, day, count(*) from public.availability group by trip_id, day;

-- How many members have marked at least one day: a number, never who.
create function public.marked_member_count(t uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when is_member(t) then (select count(distinct user_id)::int from availability where trip_id = t) else 0 end;
$$;

alter publication supabase_realtime add table public.day_counts;
