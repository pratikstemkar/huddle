-- Huddle: core schema.
-- Everyone in a trip can read everything in it; each person only writes their own availability and votes.

create extension if not exists pgcrypto;

-- Profiles ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Traveller'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trips ------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'sunset'
    check (color in ('sunset', 'lagoon', 'mango', 'plum', 'bougainvillea', 'sky')),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invite_code text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  status text not null default 'planning' check (status in ('planning', 'locked')),
  locked_start date,
  locked_end date,
  locked_destination_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('organiser', 'member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.availability (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id, day)
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  note text,
  url text,
  image_url text,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.trips
  add constraint trips_locked_destination_fk
  foreign key (locked_destination_id) references public.destinations (id) on delete set null;

create table public.votes (
  destination_id uuid not null references public.destinations (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (destination_id, user_id)
);

create index on public.trip_members (user_id);
create index on public.availability (trip_id);
create index on public.destinations (trip_id);
create index on public.votes (trip_id);

-- Helpers ----------------------------------------------------------------

create function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid());
$$;

create function public.is_organiser(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid() and role = 'organiser');
$$;

-- The creator becomes the organiser automatically.
create function public.add_trip_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into trip_members (trip_id, user_id, role) values (new.id, new.created_by, 'organiser');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.add_trip_creator();

-- Join a trip with its invite code. Returns the trip id.
create function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into t from trips where invite_code = lower(trim(code));
  if t is null then raise exception 'That invite code does not match a trip'; end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid()) on conflict do nothing;
  return t;
end;
$$;

-- Row level security ----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.availability enable row level security;
alter table public.destinations enable row level security;
alter table public.votes enable row level security;

create policy "see yourself and trip-mates" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from trip_members a join trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "edit own profile" on public.profiles for update using (id = auth.uid());

create policy "members read trips" on public.trips for select using (created_by = auth.uid() or public.is_member(id));
create policy "anyone signed in creates trips" on public.trips for insert with check (created_by = auth.uid());
create policy "organisers edit trips" on public.trips for update using (public.is_organiser(id));
create policy "organisers delete trips" on public.trips for delete using (public.is_organiser(id));

create policy "members see members" on public.trip_members for select using (public.is_member(trip_id));
create policy "leave a trip" on public.trip_members for delete using (user_id = auth.uid());

create policy "members read availability" on public.availability for select using (public.is_member(trip_id));
create policy "mark own availability" on public.availability for insert with check (user_id = auth.uid() and public.is_member(trip_id));
create policy "clear own availability" on public.availability for delete using (user_id = auth.uid());

create policy "members read destinations" on public.destinations for select using (public.is_member(trip_id));
create policy "members add destinations" on public.destinations for insert with check (created_by = auth.uid() and public.is_member(trip_id));
create policy "remove own destinations" on public.destinations for delete using (created_by = auth.uid() or public.is_organiser(trip_id));

create policy "members read votes" on public.votes for select using (public.is_member(trip_id));
create policy "cast own vote" on public.votes for insert with check (
  user_id = auth.uid()
  and public.is_member(trip_id)
  and exists (select 1 from destinations d where d.id = destination_id and d.trip_id = votes.trip_id)
);
create policy "remove own vote" on public.votes for delete using (user_id = auth.uid());

-- Realtime: stream changes so the heatmap and vote counts update live.
alter publication supabase_realtime add table public.availability, public.destinations, public.votes, public.trips;
