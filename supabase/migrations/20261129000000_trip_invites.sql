-- Trip invites: an organiser invites people they already share a trip or group with (usually a whole
-- group at once). The invitee sees it on the Groups tab under "Waiting on you" and joins by accepting.

create table public.trip_invites (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_invites_user_idx on public.trip_invites (user_id);

alter table public.trip_invites enable row level security;

create policy "see your invites and your trip's" on public.trip_invites for select
  using (user_id = auth.uid() or public.is_member(trip_id));
create policy "decline your invite, or organisers cancel it" on public.trip_invites for delete
  using (user_id = auth.uid() or public.is_organiser(trip_id));

-- An organiser sees who they invited, and an invitee sees who invited them.
create function public.trip_invite_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_invites i where i.user_id = auth.uid() and i.invited_by = p)
      or exists (select 1 from trip_invites i where i.user_id = p and is_member(i.trip_id));
$$;
create policy "see trip invites' people" on public.profiles for select using (public.trip_invite_visible(id));

-- Invites people I already share a trip or group with; skips members and people already invited.
-- Organisers only.
create function public.invite_to_trip(t uuid, user_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organiser(t) then
    raise exception 'Only the organiser can invite people' using errcode = '42501';
  end if;
  insert into trip_invites (trip_id, user_id, invited_by)
  select t, p, auth.uid()
  from (select distinct unnest(user_ids) as p) u
  where p <> auth.uid()
    and knows_person(p)
    and not exists (select 1 from trip_members m where m.trip_id = t and m.user_id = p)
  on conflict do nothing;
end $$;

-- Accepting joins the trip and returns its id.
create function public.accept_trip_invite(t uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from trip_invites where trip_id = t and user_id = auth.uid()) then
    raise exception 'That invite is no longer there' using errcode = 'P0001';
  end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid()) on conflict do nothing;
  delete from trip_invites where trip_id = t and user_id = auth.uid();
  return t;
end $$;

-- Joining by code or link also answers an invite to the same trip.
create or replace function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into t from trips where invite_code = lower(trim(code));
  if t is null then raise exception 'That invite code does not match a trip'; end if;
  insert into trip_members (trip_id, user_id) values (t, auth.uid()) on conflict do nothing;
  delete from trip_invites where trip_id = t and user_id = auth.uid();
  return t;
end;
$$;

-- The trip invites waiting on me: what the trip is called, who asked, how big it is.
create function public.my_trip_invites()
returns table (trip_id uuid, trip_name text, trip_color text, members int, dates_set boolean, from_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.trip_id, t.name, t.color,
         (select count(*)::int from trip_members m where m.trip_id = t.id),
         (t.fixed_start is not null or t.status = 'locked'),
         coalesce(p.display_name, 'Someone'), i.created_at
  from trip_invites i
  join trips t on t.id = i.trip_id
  left join profiles p on p.id = i.invited_by
  where i.user_id = auth.uid()
  order by i.created_at desc;
$$;

revoke all on function public.invite_to_trip(uuid, uuid[]) from public, anon;
revoke all on function public.accept_trip_invite(uuid) from public, anon;
revoke all on function public.my_trip_invites() from public, anon;
grant execute on function public.invite_to_trip(uuid, uuid[]) to authenticated;
grant execute on function public.accept_trip_invite(uuid) to authenticated;
grant execute on function public.my_trip_invites() to authenticated;

alter publication supabase_realtime add table public.trip_invites;
