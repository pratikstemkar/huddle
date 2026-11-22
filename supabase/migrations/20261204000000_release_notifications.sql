-- Release notifications: when a version is tagged, everyone with Huddle on a phone hears about it.
--
-- Whether a phone takes the release over the air depends on the phone, not the release: an installed
-- build only accepts updates published against its own runtime version (the fingerprint of its native
-- side). So each device now reports its runtime version with its push token, and announce_release()
-- compares it with the release's:
--
--   same runtime       the OTA reaches it. "Close Huddle and open it again."  Tap opens the app.
--   other or unknown   it needs the new APK. "Tap to download."  Tap opens the GitHub release page.
--
-- A token registered before this migration has no runtime version and gets the APK message, which is
-- the one that always works. A person with several phones is told according to the newest one.
--
-- The APK workflow calls announce_release() once the GitHub release exists and the OTA is published,
-- with a secret it holds as RELEASE_ANNOUNCE_SECRET. The same value lives in Vault:
--
--   select vault.create_secret('<random string>', 'release_announce_secret');
--
-- Without it every call is refused and nothing is announced.

-- Devices report their runtime version ------------------------------------

alter table public.push_tokens
  add column runtime_version text check (runtime_version is null or char_length(runtime_version) <= 100);

-- Old app builds call this with (tok, plat) only; the default keeps them working.
drop function public.register_push_token(text, text);
create function public.register_push_token(tok text, plat text, runtime text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  insert into push_tokens (token, user_id, platform, runtime_version) values (tok, auth.uid(), plat, nullif(runtime, ''))
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, runtime_version = excluded.runtime_version, updated_at = now();
end $$;
revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- A new kind and its own switch -------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'trip_invite', 'group_invite', 'hangout_invite',
  'trip_locked', 'hangout_locked', 'hangout_cancelled',
  'nudge_days', 'nudge_vote',
  'trip_joined',
  'app_release'
));

alter table public.notification_prefs add column updates boolean not null default true;

create or replace function public.notification_category(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('trip_invite', 'group_invite', 'hangout_invite') then 'invites'
    when k in ('trip_locked', 'hangout_locked', 'hangout_cancelled') then 'plans'
    when k in ('nudge_days', 'nudge_vote') then 'nudges'
    when k = 'app_release' then 'updates'
    else 'joins'
  end;
$$;

create or replace function public.push_enabled(u uuid, k text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case notification_category(k)
      when 'invites' then p.invites when 'plans' then p.plans when 'nudges' then p.nudges
      when 'updates' then p.updates else p.joins
    end
    from notification_prefs p where p.user_id = u
  ), true);
$$;

-- Releases ----------------------------------------------------------------

-- One row per announced version, so a re-run workflow never tells anyone twice. Server-only.
create table public.releases (
  version text primary key check (version ~ '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$'),
  runtime_version text not null check (char_length(runtime_version) between 1 and 100),
  url text not null,
  notified int not null default 0,
  announced_at timestamptz not null default now()
);
alter table public.releases enable row level security;

-- The APK workflow's call. Returns how many people were told; 0 when this version was already announced.
-- Android only: there is no iOS build to point anyone at yet.
create function public.announce_release(secret text, ver text, runtime text, link text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if coalesce(announce_release.secret, '') = '' or not exists (
    select 1 from vault.decrypted_secrets
    where name = 'release_announce_secret'
      -- Compare digests so the check doesn't leak how much of the secret matched.
      and extensions.digest(decrypted_secret, 'sha256') = extensions.digest(announce_release.secret, 'sha256')
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if link is null or link !~ ('^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/releases/tag/v' || replace(ver, '.', '\.') || '$') then
    raise exception 'The link must be this version''s GitHub release page' using errcode = 'P0001';
  end if;

  insert into releases (version, runtime_version, url) values (ver, runtime, link) on conflict (version) do nothing;
  if not found then return 0; end if;

  insert into notifications (user_id, kind, title, body, url, push_status)
  select d.user_id, 'app_release',
         case when ota then 'Huddle ' || ver || ' is ready' else 'Huddle ' || ver || ' needs a new download' end,
         case when ota then 'Close Huddle and open it again to get the update.'
              else 'Tap to download the new app and install it over this one.' end,
         case when ota then '/' else link end,
         case when push_enabled(d.user_id, 'app_release') then 'pending' else 'skipped' end
  from (
    select distinct on (user_id) user_id, runtime_version is not distinct from runtime as ota
    from push_tokens
    where platform = 'android'
    order by user_id, updated_at desc
  ) d;
  get diagnostics n = row_count;

  update releases set notified = n where version = ver;
  return n;
end $$;

revoke all on function public.announce_release(text, text, text, text) from public, anon, authenticated;
-- The workflow calls it with the publishable key; the secret is the check.
grant execute on function public.announce_release(text, text, text, text) to anon;
