-- Notifications: an in-app Activity list, and push to the phones people are signed in on.
--
-- Triggers and functions add rows to `notifications` (one per person to tell). Each row is both an
-- Activity item and a pending push. The `send-push` edge function drains pending rows and sends them
-- through Expo's push service. It is kicked by pg_net after each insert and every few minutes by
-- pg_cron (retries and delivery receipts), but only once the two Vault secrets below exist:
--
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<random string, also set as PUSH_SECRET on the function>', 'push_function_secret');
--
-- Without them nothing is sent and rows stay pending; Activity still works.
--
-- The server decides who hears about what, so a nudge never tells the sender who hasn't marked or voted.
-- Nothing is recorded for changes made without a signed-in user (seed data, admin fixes).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Tables -----------------------------------------------------------------

-- One row per device. A token belongs to whoever signed in on that device last.
create table public.push_tokens (
  token text primary key check (char_length(token) <= 200 and token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'trip_invite', 'group_invite', 'hangout_invite',
    'trip_locked', 'hangout_locked', 'hangout_cancelled',
    'nudge_days', 'nudge_vote',
    'trip_joined'
  )),
  title text not null,
  body text not null,
  -- Where tapping it goes, an app path like /trip/<id>.
  url text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  trip_id uuid references public.trips (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  hangout_id uuid references public.hangouts (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Push delivery: pending -> sending -> sent | skipped (muted, no device, too old) | failed.
  push_status text not null default 'pending' check (push_status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_attempts int not null default 0,
  push_claimed_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at) where push_status in ('pending', 'sending');

-- Expo's tickets, kept until the delivery receipt is checked (about 15 minutes later).
create table public.push_tickets (
  ticket_id text primary key,
  token text not null,
  notification_id uuid references public.notifications (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index push_tickets_created_idx on public.push_tickets (created_at);

-- What to push. Activity always lists everything; these only decide what reaches the phone.
create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  invites boolean not null default true,
  plans boolean not null default true,
  nudges boolean not null default true,
  joins boolean not null default true,
  updated_at timestamptz not null default now()
);

-- When each trip was last nudged about each thing, so a group gets at most one nudge a day.
create table public.trip_nudges (
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null check (kind in ('days', 'vote')),
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id) on delete set null,
  primary key (trip_id, kind)
);

alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tickets enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.trip_nudges enable row level security;

-- Tokens change only through register_push_token / unregister_push_token. Tickets and nudges are server-only.
create policy "see own devices" on public.push_tokens for select using (user_id = auth.uid());
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "read own prefs" on public.notification_prefs for select using (user_id = auth.uid());
create policy "add own prefs" on public.notification_prefs for insert with check (user_id = auth.uid());
create policy "change own prefs" on public.notification_prefs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- Helpers ----------------------------------------------------------------

create function public.notification_category(k text) returns text
language sql immutable as $$
  select case
    when k in ('trip_invite', 'group_invite', 'hangout_invite') then 'invites'
    when k in ('trip_locked', 'hangout_locked', 'hangout_cancelled') then 'plans'
    when k in ('nudge_days', 'nudge_vote') then 'nudges'
    else 'joins'
  end;
$$;

create function public.push_enabled(u uuid, k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case notification_category(k)
      when 'invites' then p.invites when 'plans' then p.plans when 'nudges' then p.nudges else p.joins
    end
    from notification_prefs p where p.user_id = u
  ), true);
$$;

create function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from profiles where id = auth.uid()), 'Someone');
$$;

-- "12 Mar", "12–15 Mar", "28 Mar – 2 Apr", with the year when it isn't this year.
create function public.short_range(a date, b date) returns text
language sql stable as $$
  select case
    when a = b then to_char(a, 'FMDD Mon')
    when date_trunc('month', a) = date_trunc('month', b) then to_char(a, 'FMDD') || '–' || to_char(b, 'FMDD Mon')
    else to_char(a, 'FMDD Mon') || ' – ' || to_char(b, 'FMDD Mon')
  end || case when extract(year from b) <> extract(year from current_date) then ' ' || extract(year from b)::text else '' end;
$$;

-- Asks the send-push function to drain pending rows. Never fails the caller.
create function public.kick_push_sender() returns void
language plpgsql security definer set search_path = public as $$
declare fn_url text; fn_secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'push_function_secret';
  if fn_url is null or fn_secret is null then return; end if;
  perform net.http_post(
    url := fn_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', fn_secret),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'kick_push_sender: %', sqlerrm;
end $$;

-- Records one notification for each recipient except me. Returns how many were recorded.
create function public.notify(
  recipients uuid[], k text, t text, b text, link text,
  trip uuid default null, grp uuid default null, hang uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  insert into notifications (user_id, kind, title, body, url, actor_id, trip_id, group_id, hangout_id, push_status)
  select r, k, left(t, 120), left(b, 200), link, auth.uid(), trip, grp, hang,
         case when push_enabled(r, k) then 'pending' else 'skipped' end
  from (select distinct unnest(recipients) as r) x
  where r is not null and r <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

create function public.notifications_kick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from new_rows where push_status = 'pending') then
    perform kick_push_sender();
  end if;
  return null;
end $$;

create trigger notifications_kick
  after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function public.notifications_kick();

-- Events -----------------------------------------------------------------

create function public.on_trip_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(array[new.user_id], 'trip_invite',
    my_name() || ' invited you to ' || (select name from trips where id = new.trip_id),
    'Open Huddle to join the trip.', '/groups', trip := new.trip_id);
  return null;
end $$;
create trigger notify_trip_invite after insert on public.trip_invites
  for each row execute function public.on_trip_invite();

create function public.on_group_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(array[new.user_id], 'group_invite',
    my_name() || ' added you to ' || (select name from groups where id = new.group_id),
    'Accept the invite to join the group.', '/groups', grp := new.group_id);
  return null;
end $$;
create trigger notify_group_invite after insert on public.group_invites
  for each row execute function public.on_group_invite();

create function public.on_hangout_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare h hangouts;
begin
  select * into h from hangouts where id = new.hangout_id;
  if h.created_by is distinct from auth.uid() then return null; end if;
  perform notify(array[new.user_id], 'hangout_invite',
    my_name() || ' invited you to ' || h.name,
    case when h.mode = 'find' then 'Say which times work for you.' else 'Let them know if you''re in.' end,
    '/hangout/' || h.id, grp := h.group_id, hang := h.id);
  return null;
end $$;
create trigger notify_hangout_member after insert on public.hangout_members
  for each row execute function public.on_hangout_member();

create function public.on_trip_locked() returns trigger
language plpgsql security definer set search_path = public as $$
declare place text;
begin
  select title into place from destinations where id = new.locked_destination_id;
  perform notify(
    array(select user_id from trip_members where trip_id = new.id), 'trip_locked',
    new.name || ' is happening',
    concat_ws(' · ', place, short_range(new.locked_start, new.locked_end)),
    '/trip/' || new.id, trip := new.id);
  return null;
end $$;
create trigger notify_trip_locked after update of status on public.trips
  for each row when (old.status = 'planning' and new.status = 'locked')
  execute function public.on_trip_locked();

create function public.on_hangout_settled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'locked' then
    perform notify(array(select user_id from hangout_members where hangout_id = new.id), 'hangout_locked',
      new.name || ': the time is set', 'Open it to see when, and add it to your calendar.',
      '/hangout/' || new.id, grp := new.group_id, hang := new.id);
  else
    perform notify(array(select user_id from hangout_members where hangout_id = new.id), 'hangout_cancelled',
      new.name || ' is off', my_name() || ' cancelled it.',
      '/hangout/' || new.id, grp := new.group_id, hang := new.id);
  end if;
  return null;
end $$;
create trigger notify_hangout_settled after update of status on public.hangouts
  for each row when (old.status is distinct from new.status and new.status in ('locked', 'cancelled') and old.status <> 'cancelled')
  execute function public.on_hangout_settled();

-- Someone joining by themselves (code, link or invite); the creator's own row is the organiser row.
create function public.on_trip_joined() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.user_id is distinct from auth.uid() or new.role <> 'member' then return null; end if;
  select count(*)::int into n from trip_members where trip_id = new.trip_id;
  perform notify(
    array(select user_id from trip_members where trip_id = new.trip_id and role = 'organiser'), 'trip_joined',
    my_name() || ' joined ' || (select name from trips where id = new.trip_id),
    n || ' people are in now.', '/trip/' || new.trip_id, trip := new.trip_id);
  return null;
end $$;
create trigger notify_trip_joined after insert on public.trip_members
  for each row execute function public.on_trip_joined();

-- Functions for the app --------------------------------------------------

-- Pings the members who still need to mark their days ('days') or vote ('vote'). Any member can send it,
-- at most once a day per trip and kind. Returns how many people were nudged, never who.
create function public.nudge_trip(t uuid, what text) returns int
language plpgsql security definer set search_path = public as $$
declare tr trips; last_sent timestamptz; who uuid[]; n int;
begin
  if not is_member(t) then
    raise exception 'You are not in this trip' using errcode = '42501';
  end if;
  if what not in ('days', 'vote') then
    raise exception 'Unknown nudge' using errcode = 'P0001';
  end if;
  select * into tr from trips where id = t;
  if tr.status <> 'planning' then
    raise exception 'This trip is already locked' using errcode = 'P0001';
  end if;
  if what = 'days' and tr.fixed_start is not null then
    raise exception 'This trip already has its dates' using errcode = 'P0001';
  end if;
  select sent_at into last_sent from trip_nudges where trip_id = t and kind = what;
  if last_sent > now() - interval '20 hours' then
    raise exception 'Everyone was nudged about this today already. Try again tomorrow.' using errcode = 'P0001';
  end if;

  if what = 'days' then
    who := array(select m.user_id from trip_members m where m.trip_id = t
                 and not exists (select 1 from availability a where a.trip_id = t and a.user_id = m.user_id));
    n := notify(who, 'nudge_days', tr.name || ': mark your free days',
      my_name() || ' is waiting on a few people to pick dates.', '/trip/' || t || '/vote?seg=dates', trip := t);
  else
    who := array(select m.user_id from trip_members m where m.trip_id = t
                 and not exists (select 1 from votes v where v.trip_id = t and v.user_id = m.user_id));
    n := notify(who, 'nudge_vote', tr.name || ': vote on where to go',
      my_name() || ' nudged everyone who hasn''t voted yet.', '/trip/' || t || '/vote?seg=places', trip := t);
  end if;

  if n > 0 then
    insert into trip_nudges (trip_id, kind, sent_at, sent_by) values (t, what, now(), auth.uid())
    on conflict (trip_id, kind) do update set sent_at = excluded.sent_at, sent_by = excluded.sent_by;
  end if;
  return n;
end $$;

-- Marks the given notifications read (all of mine when ids is null).
create function public.mark_notifications_read(ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (ids is null or id = any (ids));
$$;

-- This device now pushes to me. A token another account had on this device moves over.
create function public.register_push_token(tok text, plat text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  insert into push_tokens (token, user_id, platform) values (tok, auth.uid(), plat)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create function public.unregister_push_token(tok text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where token = tok and user_id = auth.uid();
$$;

-- For the send-push function (service role): claims up to max_rows pending pushes with each person's
-- devices and unread count (the iOS badge). Rows older than a day are skipped, not sent late.
create function public.claim_pushes(max_rows int default 200)
returns table (id uuid, user_id uuid, kind text, title text, body text, url text, attempts int, tokens text[], badge int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update notifications set push_status = 'skipped'
   where push_status in ('pending', 'sending') and created_at < now() - interval '1 day';
  -- A sender that died mid-batch: try again.
  update notifications set push_status = case when push_attempts >= 5 then 'failed' else 'pending' end
   where push_status = 'sending' and push_claimed_at < now() - interval '10 minutes';

  return query
  with picked as (
    select n.id from notifications n
    where n.push_status = 'pending'
    order by n.created_at
    limit max_rows
    for update skip locked
  ), claimed as (
    update notifications n
       set push_status = 'sending', push_attempts = n.push_attempts + 1, push_claimed_at = now()
      from picked where n.id = picked.id
    returning n.id, n.user_id, n.kind, n.title, n.body, n.url, n.push_attempts
  )
  select c.id, c.user_id, c.kind, c.title, c.body, c.url, c.push_attempts,
         coalesce((select array_agg(pt.token order by pt.updated_at desc) from push_tokens pt where pt.user_id = c.user_id), '{}'),
         (select count(*)::int from notifications u where u.user_id = c.user_id and u.read_at is null)
  from claimed c;
end $$;

-- Grants -----------------------------------------------------------------

revoke all on function public.push_enabled(uuid, text) from public, anon, authenticated;
revoke all on function public.my_name() from public, anon, authenticated;
revoke all on function public.kick_push_sender() from public, anon, authenticated;
revoke all on function public.notify(uuid[], text, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.notifications_kick() from public, anon, authenticated;
revoke all on function public.on_trip_invite() from public, anon, authenticated;
revoke all on function public.on_group_invite() from public, anon, authenticated;
revoke all on function public.on_hangout_member() from public, anon, authenticated;
revoke all on function public.on_trip_locked() from public, anon, authenticated;
revoke all on function public.on_hangout_settled() from public, anon, authenticated;
revoke all on function public.on_trip_joined() from public, anon, authenticated;
revoke all on function public.claim_pushes(int) from public, anon, authenticated;
grant execute on function public.claim_pushes(int) to service_role;

revoke all on function public.nudge_trip(uuid, text) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.nudge_trip(uuid, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Retries and receipts every five minutes (does nothing until the Vault secrets exist).
select cron.schedule('send-push', '*/5 * * * *', 'select public.kick_push_sender()');
