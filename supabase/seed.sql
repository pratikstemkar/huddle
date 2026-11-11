-- LOCAL DEVELOPMENT ONLY. Runs on `bunx supabase db reset`; never run against production.
-- Creates the four developer sign-in users shown on the sign-in screen.
-- Password for all of them: trip-dev-password (matches EXPO_PUBLIC_DEV_PASSWORD in .env.example).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt('trip-dev-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(),
  '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aarav@dev.test', 'Aarav'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'meera@dev.test', 'Meera'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'kabir@dev.test', 'Kabir'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'zoya@dev.test', 'Zoya')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@dev.test';

-- A sample trip so the home screen isn't empty: Aarav organises, Meera has joined.
insert into public.trips (id, name, color, created_by, invite_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Goa in March', 'sunset', '11111111-1111-1111-1111-111111111111', 'goa2027');

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
