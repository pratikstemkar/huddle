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

-- Availability for the Goa trip, relative to today so the calendar always has data.
-- Aarav is free days 10-16 from now, Meera days 13-19: they overlap on 13-16.
insert into public.availability (trip_id, user_id, day)
select 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', current_date + n from generate_series(10, 16) n;
insert into public.availability (trip_id, user_id, day)
select 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', current_date + n from generate_series(13, 19) n;

-- Destination suggestions for the Goa trip, with a spread of votes so the ranking has something to show.
insert into public.destinations (id, trip_id, title, note, url, created_by, created_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Palolem Beach', 'Quiet cove, silent-disco nights and cheap beach huts.', 'https://en.wikipedia.org/wiki/Palolem', '11111111-1111-1111-1111-111111111111', now() - interval '3 hours'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Old Goa and Fontainhas', 'Churches, the Latin Quarter and good cafes.', null, '22222222-2222-2222-2222-222222222222', now() - interval '2 hours'),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Anjuna flea market', null, null, '11111111-1111-1111-1111-111111111111', now() - interval '1 hour');

insert into public.votes (destination_id, trip_id, user_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

-- A locked trip, so the summary screen has something to show without locking one by hand.
-- Created as planning first: the locked destination must exist before the trip can point at it.
insert into public.trips (id, name, color, created_by, invite_code)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pondy long weekend', 'lagoon', '11111111-1111-1111-1111-111111111111', 'pondy27');

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

insert into public.destinations (id, trip_id, title, note, url, created_by) values
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pondicherry', 'Rock Beach walks, French Quarter cafes and a sunrise ride.', 'https://en.wikipedia.org/wiki/Pondicherry', '11111111-1111-1111-1111-111111111111');

insert into public.votes (destination_id, trip_id, user_id) values
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

update public.trips
   set status = 'locked', locked_start = current_date + 40, locked_end = current_date + 42,
       locked_destination_id = 'dddddddd-0000-0000-0000-000000000004'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- A trip with names hidden, so "who marked which day" being off can be tested without setting it by hand.
-- Meera organises; Aarav and Kabir have joined. Each only sees their own days, plus counts for everyone.
insert into public.trips (id, name, color, created_by, invite_code, show_who_marked)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'Hampi surprise', 'mango', '22222222-2222-2222-2222-222222222222', 'hampi27', false);

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');

insert into public.availability (trip_id, user_id, day)
select 'aaaaaaaa-0000-0000-0000-000000000003', u, current_date + n
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 20, 24),
  ('22222222-2222-2222-2222-222222222222'::uuid, 22, 27),
  ('33333333-3333-3333-3333-333333333333'::uuid, 23, 25)
) as r(u, a, b), generate_series(r.a, r.b) n;
