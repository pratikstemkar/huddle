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
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Goa in March', 'coral', '11111111-1111-1111-1111-111111111111', 'goa2027');

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
values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pondy long weekend', 'mint', '11111111-1111-1111-1111-111111111111', 'pondy27');

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444');

insert into public.destinations (id, trip_id, title, note, url, created_by) values
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pondicherry', 'Rock Beach walks, French Quarter cafes and a sunrise ride.', 'https://en.wikipedia.org/wiki/Pondicherry', '11111111-1111-1111-1111-111111111111');

insert into public.votes (destination_id, trip_id, user_id) values
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

update public.trips
   set status = 'locked', locked_start = current_date + 40, locked_end = current_date + 42,
       locked_destination_id = 'dddddddd-0000-0000-0000-000000000004'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- Pondy's plan: days 1 and 2 have something on, day 3 is still empty ("2 of 3 days planned").
insert into public.itinerary_items (trip_id, day, start_time, title, note, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000002', current_date + 40, '06:00', 'Sunrise at Rock Beach', 'Meet at the Gandhi statue', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', current_date + 40, '13:00', 'Lunch at Villa Shanti', 'Booked for 4', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000002', current_date + 41, '10:00', 'Auroville visitor centre', 'Scooters from the guesthouse', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000002', current_date + 41, '19:30', 'Dinner in White Town', 'Somewhere with a courtyard', '44444444-4444-4444-4444-444444444444');

-- Pondy's money, with the shares written out as save_expense() would (remainder to the first user ids).
-- Aarav is owed; Meera, Kabir and Zoya each owe a little. Zoya has already paid Meera back ₹500.
insert into public.expenses (id, trip_id, title, category, amount_minor, paid_by, created_by, created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Guesthouse', 'stay', 1200000, '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Scooters', 'travel', 300000, '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', now() - interval '2 days'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Dinner', 'food', 340000, '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', now() - interval '1 day');

insert into public.expense_shares (expense_id, trip_id, user_id, share_minor) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 300000),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 300000),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 300000),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 300000),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 75000),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 75000),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 75000),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 75000),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 113334),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 113333),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 113333);

insert into public.settlements (trip_id, from_user, to_user, amount_minor, created_by, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 50000, '44444444-4444-4444-4444-444444444444', now() - interval '12 hours');

-- A trip with names hidden, so "who marked which day" being off can be tested without setting it by hand.
-- Meera organises; Aarav and Kabir have joined. Each only sees their own days, plus counts for everyone.
insert into public.trips (id, name, color, created_by, invite_code, show_who_marked)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'Hampi surprise', 'beak', '22222222-2222-2222-2222-222222222222', 'hampi27', false);

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

-- A trip that's over, so the home screen shows its "Done" chip. Zoya organises; everyone went.
insert into public.trips (id, name, color, created_by, invite_code)
values ('aaaaaaaa-0000-0000-0000-000000000004', 'Coorg weekend', 'blush', '44444444-4444-4444-4444-444444444444', 'coorg26');

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333');

insert into public.destinations (id, trip_id, title, note, created_by) values
  ('dddddddd-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004', 'Madikeri', 'Coffee estates and Abbey Falls.', '44444444-4444-4444-4444-444444444444');

update public.trips
   set status = 'locked', locked_start = current_date - 60, locked_end = current_date - 58,
       locked_destination_id = 'dddddddd-0000-0000-0000-000000000005'
 where id = 'aaaaaaaa-0000-0000-0000-000000000004';

insert into public.expenses (id, trip_id, title, category, amount_minor, paid_by, created_by, created_at) values
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'Homestay', 'stay', 800000, '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', now() - interval '59 days');

insert into public.expense_shares (expense_id, trip_id, user_id, share_minor)
select 'eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', u, 200000
from unnest(array[
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444'
]::uuid[]) u;

-- A trip whose organiser set the dates up front: still planning (the place is open), but the Plan
-- tab already works on those days. Kabir organises; Aarav and Zoya have joined.
insert into public.trips (id, name, color, created_by, invite_code, fixed_start, fixed_end)
values ('aaaaaaaa-0000-0000-0000-000000000005', 'Udaipur in winter', 'iris', '33333333-3333-3333-3333-333333333333', 'udaipur27',
        current_date + 70, current_date + 73);

insert into public.trip_members (trip_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444');

insert into public.destinations (id, trip_id, title, note, created_by) values
  ('dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000005', 'Lake Pichola', 'Boat ride at sunset.', '33333333-3333-3333-3333-333333333333'),
  ('dddddddd-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000005', 'Kumbhalgarh', 'The great wall, a day trip away.', '11111111-1111-1111-1111-111111111111');

insert into public.votes (destination_id, trip_id, user_id) values
  ('dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333');

insert into public.itinerary_items (trip_id, day, start_time, title, note, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000005', current_date + 70, '16:00', 'Check in and walk the old city', null, '33333333-3333-3333-3333-333333333333');

-- Groups: "College gang" (Aarav admin, Meera member, Kabir member) and "Flatmates" (Meera admin).
-- Zoya has a pending invite to College gang so the Groups tab shows "Waiting on you".
insert into public.groups (id, name, color, created_by, invite_code) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'College gang', 'iris', '11111111-1111-1111-1111-111111111111', 'college1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Flatmates', 'mint', '22222222-2222-2222-2222-222222222222', 'flatmate');

insert into public.group_members (group_id, user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');

insert into public.group_invites (group_id, user_id, invited_by) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

-- A trip invite: Aarav (organiser of Goa in March) has invited Zoya, so her Groups tab shows a trip
-- under "Waiting on you" next to the group invite.
insert into public.trip_invites (trip_id, user_id, invited_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

-- A hangout: Aarav asked College gang to dinner and offered three evenings. Meera has answered one;
-- Zoya isn't in the group yet, so it shows for Aarav, Meera and Kabir.
insert into public.hangouts (id, group_id, created_by, kind, name, place_name, mode, duration_min, answers_close_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'dinner', 'Dinner with the gang', 'Nori House, Indiranagar', 'find', 120, now() + interval '1 day');
insert into public.hangout_members (hangout_id, user_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('eeeeeeee-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
insert into public.hangout_slots (id, hangout_id, starts_at, ends_at) values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', date_trunc('day', now()) + interval '3 days 19 hours', date_trunc('day', now()) + interval '3 days 21 hours'),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', date_trunc('day', now()) + interval '4 days 19 hours', date_trunc('day', now()) + interval '4 days 21 hours'),
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', date_trunc('day', now()) + interval '5 days 13 hours', date_trunc('day', now()) + interval '5 days 15 hours');
insert into public.hangout_answers (slot_id, user_id, answer) values
  ('ffffffff-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'yes'),
  ('ffffffff-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'maybe');
