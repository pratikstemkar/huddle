-- Hangouts: a quick plan (dinner, coffee, a movie) made with one of your groups.
-- "find" mode: the organiser offers a few slots and everyone answers works / if needed / can't, then the
-- organiser locks one. "set" mode: one slot, everyone says in (yes) or out (no).
-- Invitees are members straight away; there is no accept step.

create table public.hangouts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  kind text not null default 'dinner' check (kind in ('dinner', 'coffee', 'movie', 'drinks', 'games', 'out')),
  name text not null check (char_length(name) between 1 and 60),
  place_url text check (place_url is null or (char_length(place_url) <= 500 and place_url ~* '^https?://')),
  place_name text check (place_name is null or char_length(place_name) <= 120),
  mode text not null check (mode in ('find', 'set')),
  duration_min int check (duration_min is null or duration_min between 15 and 720),
  answers_close_at timestamptz,
  status text not null default 'open' check (status in ('open', 'locked', 'cancelled')),
  locked_slot_id uuid,
  created_at timestamptz not null default now()
);
create index hangouts_group_idx on public.hangouts (group_id);

create table public.hangout_members (
  hangout_id uuid not null references public.hangouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (hangout_id, user_id)
);
create index hangout_members_user_idx on public.hangout_members (user_id);

create table public.hangout_slots (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  check (ends_at is null or ends_at > starts_at)
);
create index hangout_slots_hangout_idx on public.hangout_slots (hangout_id, starts_at);

alter table public.hangouts
  add constraint hangouts_locked_slot_fk foreign key (locked_slot_id) references public.hangout_slots (id) on delete set null;

create table public.hangout_answers (
  slot_id uuid not null references public.hangout_slots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  primary key (slot_id, user_id)
);

create function public.is_hangout_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from hangout_members where hangout_id = h and user_id = auth.uid());
$$;

create function public.is_hangout_organiser(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from hangouts where id = h and created_by = auth.uid());
$$;

create function public.slot_hangout(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select hangout_id from hangout_slots where id = s;
$$;

alter table public.hangouts enable row level security;
alter table public.hangout_members enable row level security;
alter table public.hangout_slots enable row level security;
alter table public.hangout_answers enable row level security;

create policy "members read hangouts" on public.hangouts for select using (public.is_hangout_member(id));
create policy "organisers delete hangouts" on public.hangouts for delete using (created_by = auth.uid());
create policy "members see members" on public.hangout_members for select using (public.is_hangout_member(hangout_id));
create policy "leave a hangout, or organisers remove people" on public.hangout_members for delete
  using (user_id = auth.uid() or public.is_hangout_organiser(hangout_id));
create policy "members read slots" on public.hangout_slots for select using (public.is_hangout_member(hangout_id));
create policy "members read answers" on public.hangout_answers for select using (public.is_hangout_member(public.slot_hangout(slot_id)));

-- Hangout-mates can see each other's names, like group-mates.
create function public.hangout_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hangout_members a join hangout_members b on a.hangout_id = b.hangout_id
    where a.user_id = auth.uid() and b.user_id = p
  );
$$;
create policy "see hangout-mates" on public.profiles for select using (public.hangout_visible(id));

-- Creates a hangout for a group I'm in. `slots` is a json array of {starts_at, ends_at}; invitees must be in
-- the group. In "set" mode there is exactly one slot and the organiser is in already.
create function public.create_hangout(
  g uuid, k text, n text, p_url text, p_name text, m text, dur int, closes timestamptz, slots jsonb, user_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; s uuid; slot jsonb; count_slots int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_group_member(g) then
    raise exception 'You can only plan a hangout with a group you are in' using errcode = '42501';
  end if;
  count_slots := coalesce(jsonb_array_length(slots), 0);
  if count_slots = 0 or (m = 'set' and count_slots <> 1) or count_slots > 20 then
    raise exception 'Pick between one and twenty times' using errcode = 'P0001';
  end if;
  insert into hangouts (group_id, created_by, kind, name, place_url, place_name, mode, duration_min, answers_close_at)
  values (g, auth.uid(), k, trim(n), nullif(trim(p_url), ''), nullif(trim(p_name), ''), m, dur, closes)
  returning id into h;
  insert into hangout_members (hangout_id, user_id) values (h, auth.uid());
  insert into hangout_members (hangout_id, user_id)
  select h, u from (select distinct unnest(user_ids) as u) x
  where u <> auth.uid() and exists (select 1 from group_members gm where gm.group_id = g and gm.user_id = u);
  for slot in select * from jsonb_array_elements(slots) loop
    insert into hangout_slots (hangout_id, starts_at, ends_at)
    values (h, (slot ->> 'starts_at')::timestamptz, nullif(slot ->> 'ends_at', '')::timestamptz)
    returning id into s;
    if m = 'set' then
      insert into hangout_answers (slot_id, user_id, answer) values (s, auth.uid(), 'yes');
    end if;
  end loop;
  return h;
end $$;

-- Sets my answer on a slot (null clears it). Open hangouts only.
create function public.answer_hangout(s uuid, a text) returns void
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  h := slot_hangout(s);
  if h is null or not is_hangout_member(h) then
    raise exception 'That hangout is no longer there' using errcode = 'P0001';
  end if;
  if not exists (select 1 from hangouts where id = h and status = 'open') then
    raise exception 'That hangout is already settled' using errcode = 'P0001';
  end if;
  if a is null then
    delete from hangout_answers where slot_id = s and user_id = auth.uid();
  else
    insert into hangout_answers (slot_id, user_id, answer) values (s, auth.uid(), a)
    on conflict (slot_id, user_id) do update set answer = excluded.answer;
  end if;
end $$;

create function public.lock_hangout(h uuid, s uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hangout_organiser(h) then
    raise exception 'Only the organiser can lock the time' using errcode = '42501';
  end if;
  if slot_hangout(s) is distinct from h then
    raise exception 'That time is not part of this hangout' using errcode = 'P0001';
  end if;
  update hangouts set status = 'locked', locked_slot_id = s where id = h and status = 'open';
end $$;

create function public.cancel_hangout(h uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_hangout_organiser(h) then
    raise exception 'Only the organiser can cancel' using errcode = '42501';
  end if;
  update hangouts set status = 'cancelled' where id = h;
end $$;

-- My hangouts, newest first, with what the Groups tab needs: who asked, whether I've answered, the locked time.
create function public.my_hangouts()
returns table (
  hangout_id uuid, name text, kind text, mode text, status text, group_id uuid, group_name text,
  from_name text, organiser boolean, answered boolean, starts_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select h.id, h.name, h.kind, h.mode, h.status, h.group_id, g.name,
         coalesce(p.display_name, 'Someone'), h.created_by = auth.uid(),
         exists (select 1 from hangout_answers a join hangout_slots s on s.id = a.slot_id
                 where s.hangout_id = h.id and a.user_id = auth.uid()),
         (select s.starts_at from hangout_slots s where s.id = h.locked_slot_id),
         h.created_at
  from hangouts h
  join hangout_members m on m.hangout_id = h.id and m.user_id = auth.uid()
  left join groups g on g.id = h.group_id
  left join profiles p on p.id = h.created_by
  where h.status <> 'cancelled'
  order by h.created_at desc;
$$;

revoke all on function public.create_hangout(uuid, text, text, text, text, text, int, timestamptz, jsonb, uuid[]) from public, anon;
revoke all on function public.answer_hangout(uuid, text) from public, anon;
revoke all on function public.lock_hangout(uuid, uuid) from public, anon;
revoke all on function public.cancel_hangout(uuid) from public, anon;
revoke all on function public.my_hangouts() from public, anon;
grant execute on function public.create_hangout(uuid, text, text, text, text, text, int, timestamptz, jsonb, uuid[]) to authenticated;
grant execute on function public.answer_hangout(uuid, text) to authenticated;
grant execute on function public.lock_hangout(uuid, uuid) to authenticated;
grant execute on function public.cancel_hangout(uuid) to authenticated;
grant execute on function public.my_hangouts() to authenticated;

alter publication supabase_realtime add table public.hangouts, public.hangout_members, public.hangout_slots, public.hangout_answers;
