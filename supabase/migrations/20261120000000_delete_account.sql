-- Deleting your own account (required by the App Store and Google Play).
--
-- What happens to your trips:
-- 1. A trip you organise alone, with other people still in it, passes to its longest-standing member.
-- 2. A trip where you're the only member is deleted.
-- 3. Every other trip stays as it is; you just stop being in it.
-- Your free days, votes, memberships and profile are deleted. Places you suggested stay (and keep their
-- votes) with no author, the same as when someone leaves a trip.

-- Trips and places outlive their creator instead of being deleted with them.
alter table public.trips alter column created_by drop not null;
alter table public.trips drop constraint trips_created_by_fkey;
alter table public.trips
  add constraint trips_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.destinations alter column created_by drop not null;
alter table public.destinations drop constraint destinations_created_by_fkey;
alter table public.destinations
  add constraint destinations_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- What deleting my account would do to each of my trips: 'handed_over' (to new_organiser),
-- 'deleted', or 'left'. Lets the confirmation screen say exactly what will happen.
create function public.account_deletion_preview()
returns table (trip_id uuid, trip_name text, outcome text, new_organiser text)
language sql stable security definer set search_path = public as $$
  select
    t.id,
    t.name,
    case
      when heir.user_id is null and not exists (
        select 1 from trip_members o where o.trip_id = t.id and o.user_id <> auth.uid()
      ) then 'deleted'
      when heir.user_id is not null then 'handed_over'
      else 'left'
    end,
    heir.display_name
  from trip_members me
  join trips t on t.id = me.trip_id
  -- The heir exists only when I'm the trip's last organiser.
  left join lateral (
    select m.user_id, p.display_name
    from trip_members m join profiles p on p.id = m.user_id
    where m.trip_id = t.id and m.user_id <> auth.uid()
      and me.role = 'organiser'
      and not exists (
        select 1 from trip_members o
        where o.trip_id = t.id and o.role = 'organiser' and o.user_id <> auth.uid()
      )
    order by m.joined_at, m.user_id
    limit 1
  ) heir on true
  where me.user_id = auth.uid()
  order by t.created_at;
$$;

-- Deletes the signed-in user's account. Only ever the caller's own: it takes no user id.
create function public.delete_my_account() returns void
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

  -- Cascades to profiles, then memberships (whose triggers clear days and votes), sessions and identities.
  delete from auth.users where id = me;
end $$;

revoke all on function public.account_deletion_preview() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
