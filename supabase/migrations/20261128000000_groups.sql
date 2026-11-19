-- Groups: a standing crew of people you plan trips with.
--
-- Adding someone sends an invite; they join when they accept it (or when they open the group's join
-- link). Admins manage the group; every member can see who is in it. Trips can point at a group
-- (`trips.group_id`) so the group card can say how many trips it has had.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'iris' check (color in ('iris', 'beak', 'mint', 'blush', 'coral')),
  created_by uuid references public.profiles (id) on delete set null,
  invite_code text not null unique default lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.group_invites (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_invites_user_idx on public.group_invites (user_id);

alter table public.trips add column group_id uuid references public.groups (id) on delete set null;

-- Helpers ----------------------------------------------------------------

create function public.is_group_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create function public.is_group_admin(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid() and role = 'admin');
$$;

create function public.has_group_invite(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_invites where group_id = g and user_id = auth.uid());
$$;

-- Whether I already share a trip or a group with this person. Only those people can be invited.
create function public.knows_person(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members a join trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = p
  ) or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p
  );
$$;

-- People whose profile I may see because of a group: group-mates, whoever invited me, and (as an
-- admin) whoever I invited.
create function public.group_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p
  ) or exists (
    select 1 from group_invites i where i.user_id = auth.uid() and i.invited_by = p
  ) or exists (
    select 1 from group_invites i where i.user_id = p and is_group_admin(i.group_id)
  );
$$;

create policy "see group-mates and invites" on public.profiles for select using (public.group_visible(id));

-- The creator becomes the first admin; an empty group goes away.
create function public.add_group_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
create trigger on_group_created after insert on public.groups
  for each row execute function public.add_group_creator();

create function public.drop_empty_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from groups g where g.id = old.group_id and not exists (select 1 from group_members m where m.group_id = g.id);
  return old;
end;
$$;
create trigger on_group_member_left after delete on public.group_members
  for each row execute function public.drop_empty_group();

-- A group with other people in it always keeps an admin. Deleting the group itself (cascade) is fine:
-- by then the group row is already gone.
create function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and exists (select 1 from groups where id = old.group_id)
     and not exists (select 1 from group_members where group_id = old.group_id and role = 'admin' and user_id <> old.user_id)
     and exists (select 1 from group_members where group_id = old.group_id and user_id <> old.user_id)
  then
    raise exception 'Make someone else an admin first' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger guard_last_admin_update before update of role on public.group_members
  for each row execute function public.guard_last_admin();
create trigger guard_last_admin_delete before delete on public.group_members
  for each row execute function public.guard_last_admin();

-- A trip can only point at a group its creator is in.
create function public.check_trip_group() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and not exists (select 1 from group_members where group_id = new.group_id and user_id = auth.uid()) then
    raise exception 'You are not in that group' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_trip_group before insert or update of group_id on public.trips
  for each row execute function public.check_trip_group();

-- Row level security -----------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

create policy "members and invitees read groups" on public.groups for select
  using (public.is_group_member(id) or public.has_group_invite(id));
create policy "admins edit groups" on public.groups for update
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "admins delete groups" on public.groups for delete using (public.is_group_admin(id));

create policy "members see members" on public.group_members for select using (public.is_group_member(group_id));
create policy "leave a group, or admins remove members" on public.group_members for delete
  using (user_id = auth.uid() or (role = 'member' and public.is_group_admin(group_id)));
create policy "admins change roles" on public.group_members for update
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
revoke update on public.group_members from authenticated;
grant update (role) on public.group_members to authenticated;

create policy "see your invites and your group's" on public.group_invites for select
  using (user_id = auth.uid() or public.is_group_member(group_id));
create policy "decline your invite, or admins cancel it" on public.group_invites for delete
  using (user_id = auth.uid() or public.is_group_admin(group_id));

-- Functions --------------------------------------------------------------

-- Invites people I already share a trip or group with; skips members and people already invited.
create function public.invite_to_group(g uuid, user_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin(g) then
    raise exception 'Only an admin can invite people' using errcode = '42501';
  end if;
  insert into group_invites (group_id, user_id, invited_by)
  select g, p, auth.uid()
  from (select distinct unnest(user_ids) as p) u
  where p <> auth.uid()
    and knows_person(p)
    and not exists (select 1 from group_members m where m.group_id = g and m.user_id = p)
  on conflict do nothing;
end $$;

-- Creates a group (I become its admin) and invites the people I picked. Returns the group id.
create function public.create_group(group_name text, group_color text, user_ids uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  insert into groups (name, color, created_by) values (trim(group_name), group_color, auth.uid()) returning id into g;
  perform invite_to_group(g, user_ids);
  return g;
end $$;

create function public.accept_group_invite(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_invites where group_id = g and user_id = auth.uid()) then
    raise exception 'That invite is no longer there' using errcode = 'P0001';
  end if;
  insert into group_members (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
  delete from group_invites where group_id = g and user_id = auth.uid();
end $$;

-- Join a group with its invite code (the join link). Returns the group id.
create function public.join_group(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select id into g from groups where invite_code = lower(trim(code));
  if g is null then raise exception 'That invite code does not match a group' using errcode = 'P0001'; end if;
  insert into group_members (group_id, user_id) values (g, auth.uid()) on conflict do nothing;
  delete from group_invites where group_id = g and user_id = auth.uid();
  return g;
end $$;

-- What someone holding a group's join link may see before signing in: its name, colour and size.
create function public.group_invite_preview(code text)
returns table (name text, color text, members int)
language sql stable security definer set search_path = public as $$
  select g.name, g.color, (select count(*)::int from group_members m where m.group_id = g.id)
  from groups g where g.invite_code = lower(trim(code));
$$;

-- One row per group I'm in: how many people, how many trips together, my role.
create function public.group_summaries()
returns table (group_id uuid, members int, trips int, my_role text)
language sql stable security definer set search_path = public as $$
  select g.id,
         (select count(*)::int from group_members m where m.group_id = g.id),
         (select count(*)::int from trips t where t.group_id = g.id),
         me.role
  from group_members me join groups g on g.id = me.group_id
  where me.user_id = auth.uid();
$$;

-- The invites waiting on me, with the group's size and who invited me.
create function public.my_group_invites()
returns table (group_id uuid, group_name text, group_color text, members int, from_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.group_id, g.name, g.color,
         (select count(*)::int from group_members m where m.group_id = g.id),
         coalesce(p.display_name, 'Someone'), i.created_at
  from group_invites i
  join groups g on g.id = i.group_id
  left join profiles p on p.id = i.invited_by
  where i.user_id = auth.uid()
  order by i.created_at desc;
$$;

-- People I already share a trip or group with, and where from (a trip or group name).
create function public.known_people()
returns table (user_id uuid, display_name text, avatar_url text, avatar_color text, source text)
language sql stable security definer set search_path = public as $$
  with shared as (
    select b.user_id as uid, t.name as source, t.created_at as at
    from trip_members a join trip_members b on a.trip_id = b.trip_id join trips t on t.id = a.trip_id
    where a.user_id = auth.uid() and b.user_id <> auth.uid()
    union all
    select b.user_id, g.name, g.created_at
    from group_members a join group_members b on a.group_id = b.group_id join groups g on g.id = a.group_id
    where a.user_id = auth.uid() and b.user_id <> auth.uid()
  )
  select p.id, p.display_name, p.avatar_url, p.avatar_color,
         (select s.source from shared s where s.uid = p.id order by s.at desc limit 1)
  from profiles p
  where p.id in (select uid from shared)
  order by p.display_name;
$$;

-- Deleting my account: hand each group I alone administer to its longest-standing member, or delete it
-- when nobody else is in it. (Replaces the version in 20261120000000_delete_account.sql.)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r record;
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;

  for r in select * from account_deletion_preview() loop
    if r.outcome = 'handed_over' then
      update trip_members set role = 'organiser'
       where trip_id = r.trip_id
         and user_id = (
           select user_id from trip_members
            where trip_id = r.trip_id and user_id <> me
            order by joined_at, user_id limit 1
         );
    elsif r.outcome = 'deleted' then
      delete from trips where id = r.trip_id;
    end if;
  end loop;

  for r in
    select m.group_id from group_members m
    where m.user_id = me and m.role = 'admin'
      and not exists (select 1 from group_members o where o.group_id = m.group_id and o.role = 'admin' and o.user_id <> me)
  loop
    if exists (select 1 from group_members o where o.group_id = r.group_id and o.user_id <> me) then
      update group_members set role = 'admin'
       where group_id = r.group_id
         and user_id = (
           select user_id from group_members
            where group_id = r.group_id and user_id <> me
            order by joined_at, user_id limit 1
         );
    else
      delete from groups where id = r.group_id;
    end if;
  end loop;

  delete from auth.users where id = me;
end $$;

revoke all on function public.invite_to_group(uuid, uuid[]) from public, anon;
revoke all on function public.create_group(text, text, uuid[]) from public, anon;
revoke all on function public.accept_group_invite(uuid) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.group_summaries() from public, anon;
revoke all on function public.my_group_invites() from public, anon;
revoke all on function public.known_people() from public, anon;
revoke all on function public.group_invite_preview(text) from public;
grant execute on function public.invite_to_group(uuid, uuid[]) to authenticated;
grant execute on function public.create_group(text, text, uuid[]) to authenticated;
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.group_summaries() to authenticated;
grant execute on function public.my_group_invites() to authenticated;
grant execute on function public.known_people() to authenticated;
grant execute on function public.group_invite_preview(text) to anon, authenticated;

alter publication supabase_realtime add table public.groups, public.group_members, public.group_invites;
