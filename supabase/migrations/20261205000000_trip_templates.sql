-- Ready-made trips: a catalog of destinations, each with a few day-by-day itineraries, for people
-- who'd rather pick a plan than decide where to go.
--
-- create_trip_from_template() turns one into a normal trip in one go: dates fixed from the chosen start
-- day and the plan's length, the destination added as the trip's place, and every catalog item copied
-- into itinerary_items. From then on it is an ordinary trip: the plan is edited on the Plan tab like any
-- other, and the trip only remembers which template it came from (trips.template_id).
--
-- The catalog is read-only from the app. New content arrives in migrations (or Studio on the hosted DB).
-- Cover photos are hotlinked from Unsplash, as its licence asks, with the photographer's name kept for
-- the credit line.
--
-- shift_plan() moves every plan item by a number of days, so changing a trip's dates can take the plan
-- along instead of leaving it off the new dates.

-- Catalog ----------------------------------------------------------------

create table public.catalog_destinations (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  country text not null check (char_length(country) between 1 and 40),
  region text not null check (region in ('india', 'abroad')),
  tags text[] not null default '{}',
  blurb text not null check (char_length(blurb) between 1 and 300),
  cover_url text not null check (cover_url ~ '^https://images\.unsplash\.com/'),
  photo_credit text not null check (char_length(photo_credit) between 1 and 80),
  sort int not null default 0,
  published boolean not null default true
);

create table public.catalog_itineraries (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  destination_id text not null references public.catalog_destinations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 200),
  nights int not null check (nights between 1 and 14),
  pace text not null check (pace in ('easy', 'balanced', 'packed')),
  sort int not null default 0,
  published boolean not null default true
);

create table public.catalog_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id text not null references public.catalog_itineraries (id) on delete cascade,
  -- 0 is the first day of the trip.
  day_index int not null check (day_index between 0 and 14),
  start_time time not null,
  -- Same limits as itinerary_items, so a copy always fits.
  title text not null check (char_length(btrim(title)) between 1 and 80),
  note text check (note is null or char_length(note) <= 200)
);

create index on public.catalog_itineraries (destination_id);
create index on public.catalog_itinerary_items (itinerary_id, day_index, start_time);

alter table public.catalog_destinations enable row level security;
alter table public.catalog_itineraries enable row level security;
alter table public.catalog_itinerary_items enable row level security;

create policy "signed in read destinations catalog" on public.catalog_destinations for select
  to authenticated using (published);
create policy "signed in read itineraries catalog" on public.catalog_itineraries for select
  to authenticated using (
    published and exists (select 1 from catalog_destinations d where d.id = destination_id and d.published)
  );
create policy "signed in read itinerary items catalog" on public.catalog_itinerary_items for select
  to authenticated using (exists (select 1 from catalog_itineraries i where i.id = itinerary_id and i.published));

revoke all on public.catalog_destinations, public.catalog_itineraries, public.catalog_itinerary_items from anon, authenticated;
grant select on public.catalog_destinations, public.catalog_itineraries, public.catalog_itinerary_items to authenticated;

-- Which template a trip started from (null for trips started from scratch).
alter table public.trips
  add column template_id text references public.catalog_itineraries (id) on delete set null;

-- Start a trip from a template ---------------------------------------------

-- Creates the trip (I become its organiser), adds the destination as its place and copies the plan
-- onto the days from start_day. Returns the new trip's id.
create function public.create_trip_from_template(
  itinerary text,
  trip_name text,
  trip_color text,
  start_day date,
  trip_group uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  it catalog_itineraries%rowtype;
  dest catalog_destinations%rowtype;
  t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if start_day is null then raise exception 'Pick the first day of the trip' using errcode = 'P0001'; end if;

  select * into it from catalog_itineraries where id = itinerary and published;
  if not found then raise exception 'That plan is no longer available' using errcode = 'P0001'; end if;
  select * into dest from catalog_destinations where id = it.destination_id and published;
  if not found then raise exception 'That plan is no longer available' using errcode = 'P0001'; end if;

  -- The usual checks still apply: name and colour constraints, and check_trip_group for the group.
  insert into trips (name, color, created_by, fixed_start, fixed_end, group_id, template_id)
  values (btrim(trip_name), trip_color, auth.uid(), start_day, start_day + it.nights, trip_group, it.id)
  returning id into t;

  insert into destinations (trip_id, title, note, image_url, created_by)
  values (t, dest.name, dest.blurb, dest.cover_url || '?auto=format&fit=crop&w=1600&h=900&q=70', auth.uid());

  insert into itinerary_items (trip_id, day, start_time, title, note, created_by)
  select t, start_day + c.day_index, c.start_time, c.title, c.note, auth.uid()
  from catalog_itinerary_items c
  where c.itinerary_id = it.id and c.day_index <= it.nights;

  return t;
end $$;

revoke all on function public.create_trip_from_template(text, text, text, date, uuid) from public, anon;
grant execute on function public.create_trip_from_template(text, text, text, date, uuid) to authenticated;

-- Move the plan with the dates ---------------------------------------------

-- Moves every plan item on the trip by `days` (negative moves them earlier). Organisers only.
create function public.shift_plan(t uuid, days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_organiser(t) then
    raise exception 'Only the organiser can move the plan' using errcode = '42501';
  end if;
  if days is null or abs(days) > 3660 then
    raise exception 'That is too far to move the plan' using errcode = 'P0001';
  end if;
  update itinerary_items set day = day + days where trip_id = t;
end $$;

revoke all on function public.shift_plan(uuid, int) from public, anon;
grant execute on function public.shift_plan(uuid, int) to authenticated;

-- Starter content ----------------------------------------------------------

insert into public.catalog_destinations (id, name, country, region, tags, blurb, cover_url, photo_credit, sort) values
  ('goa', 'Goa', 'India', 'india', '{beach}',
   'Beaches, shacks and sunsets. North Goa for nights out, South Goa for quiet sand and long lunches.',
   'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2', 'alexey turenkov', 10),
  ('kerala', 'Kerala', 'India', 'india', '{beach,mountains}',
   'Tea hills in Munnar, houseboats on the backwaters and old Kochi by the sea.',
   'https://images.unsplash.com/photo-1593693411515-c20261bcad6e', 'Abhishek Prasad', 20),
  ('rajasthan', 'Rajasthan', 'India', 'india', '{culture,city}',
   'Forts, palaces and lakes. Pink Jaipur and lakeside Udaipur, with plenty to eat in between.',
   'https://images.unsplash.com/photo-1695956353120-54ce5e91632b', 'Maitree Patel', 30),
  ('manali', 'Manali', 'India', 'india', '{mountains,adventure}',
   'Snow at Solang, cafés in Old Manali and pine forests along the Beas.',
   'https://images.unsplash.com/photo-1712388430474-ace0c16051e2', 'Vinay', 40),
  ('rishikesh', 'Rishikesh', 'India', 'india', '{mountains,adventure}',
   'Rafting on the Ganga, riverside camps, yoga and the evening aarti.',
   'https://images.unsplash.com/photo-1720819029162-8500607ae232', 'Niloy Banerjee', 50),
  ('bali', 'Bali', 'Indonesia', 'abroad', '{beach,culture}',
   'Rice terraces and temples in Ubud, surf and sunsets on the south coast.',
   'https://images.unsplash.com/photo-1555400038-63f5ba517a47', 'Niklas Weiss', 60),
  ('thailand', 'Thailand', 'Thailand', 'abroad', '{beach,city}',
   'Island hopping off Phuket and Krabi, and street food in Bangkok.',
   'https://images.unsplash.com/photo-1534008897995-27a23e859048', 'Mulberry Digital', 70),
  ('vietnam', 'Vietnam', 'Vietnam', 'abroad', '{culture,beach}',
   'Lantern-lit Hoi An, the beaches of Da Nang and the limestone bays of the north.',
   'https://images.unsplash.com/photo-1528127269322-539801943592', 'Ammie Ngo', 80),
  ('dubai', 'Dubai', 'UAE', 'abroad', '{city,beach}',
   'Skyline views, a night in the desert and a day at the beach.',
   'https://images.unsplash.com/photo-1512453979798-5ea266f8880c', 'David Rodrigo', 90),
  ('sri-lanka', 'Sri Lanka', 'Sri Lanka', 'abroad', '{beach,mountains}',
   'Hill-country trains, tea estates and a slow finish on the south coast.',
   'https://images.unsplash.com/photo-1598955943740-6e1bfd440144', 'Adam Vandermeer', 100);

insert into public.catalog_itineraries (id, destination_id, title, summary, nights, pace, sort) values
  ('goa-north', 'goa', 'North Goa: beaches and nights out', 'Baga, Anjuna and Vagator by day, shacks and clubs by night.', 4, 'balanced', 10),
  ('goa-south', 'goa', 'South Goa: slow and sunny', 'Quiet beaches, long lunches and a day in old Panjim.', 3, 'easy', 20),
  ('kerala-classic', 'kerala', 'Kochi, Munnar and the backwaters', 'Fort Kochi, the tea hills and a night on a houseboat.', 5, 'balanced', 10),
  ('kerala-backwaters', 'kerala', 'Alleppey houseboat weekend', 'Canals, a houseboat night and Marari beach.', 3, 'easy', 20),
  ('rajasthan-royal', 'rajasthan', 'Jaipur and Udaipur', 'Two palace cities: forts and bazaars, then lakes and rooftops.', 5, 'packed', 10),
  ('rajasthan-udaipur', 'rajasthan', 'Udaipur: lakes and palaces', 'Boat rides, the City Palace and sunsets over Pichola.', 3, 'easy', 20),
  ('manali-adventure', 'manali', 'Snow, paragliding and cafés', 'Solang Valley, Old Manali and a day out to Atal Tunnel.', 4, 'packed', 10),
  ('manali-kasol', 'manali', 'Manali and Kasol', 'Mountain town, then a slow riverside stay in Parvati Valley.', 5, 'balanced', 20),
  ('rishikesh-rafting', 'rishikesh', 'Rafting weekend', 'White water, a riverside camp and the Ganga aarti.', 2, 'packed', 10),
  ('rishikesh-calm', 'rishikesh', 'Yoga, ghats and cafés', 'Morning yoga, the bridges, waterfalls and long café afternoons.', 3, 'easy', 20),
  ('bali-highlights', 'bali', 'Ubud and the south coast', 'Rice terraces, temples and a waterfall, then Uluwatu sunsets.', 6, 'balanced', 10),
  ('bali-nusa', 'bali', 'Bali and Nusa Penida', 'Seminyak beach days and an island day trip to Nusa Penida.', 5, 'packed', 20),
  ('thailand-phuket', 'thailand', 'Phuket and the islands', 'Old Town, a Phi Phi boat day and beaches in between.', 5, 'balanced', 10),
  ('thailand-bangkok-krabi', 'thailand', 'Bangkok and Krabi', 'Temples and markets in Bangkok, then islands off Krabi.', 6, 'packed', 20),
  ('vietnam-central', 'vietnam', 'Da Nang and Hoi An', 'Beaches, the Marble Mountains and Hoi An''s lantern-lit old town.', 5, 'balanced', 10),
  ('vietnam-north', 'vietnam', 'Hanoi, Ha Long Bay and Ninh Binh', 'Old Quarter food, a night on the bay and rice fields by boat.', 6, 'packed', 20),
  ('dubai-classic', 'dubai', 'City, desert and beach', 'Burj Khalifa, the old souks, a desert evening and a beach day.', 4, 'balanced', 10),
  ('dubai-weekend', 'dubai', 'Dubai long weekend', 'The highlights in three days, with time for the pool.', 2, 'packed', 20),
  ('srilanka-hills', 'sri-lanka', 'Kandy, Ella and the south coast', 'Temple of the Tooth, the hill train to Ella and Mirissa beach.', 6, 'balanced', 10),
  ('srilanka-beaches', 'sri-lanka', 'South coast beaches', 'Galle Fort, whale watching and lazy days in Mirissa.', 4, 'easy', 20);

insert into public.catalog_itinerary_items (itinerary_id, day_index, start_time, title, note) values
  -- North Goa, 4 nights
  ('goa-north', 0, '14:00', 'Check in near Baga or Anjuna', null),
  ('goa-north', 0, '17:30', 'Sunset at Baga beach', null),
  ('goa-north', 0, '21:00', 'Dinner at a beach shack', 'Seafood thali and kingfish fry'),
  ('goa-north', 1, '10:00', 'Fort Aguada and Sinquerim beach', null),
  ('goa-north', 1, '14:00', 'Lunch in Candolim', null),
  ('goa-north', 1, '22:00', 'Night out on Tito''s Lane', null),
  ('goa-north', 2, '11:00', 'Anjuna flea market', 'Wednesdays only; otherwise Mapusa market'),
  ('goa-north', 2, '16:00', 'Chapora Fort', 'The view over Vagator'),
  ('goa-north', 2, '19:00', 'Sunset drinks at Vagator', null),
  ('goa-north', 3, '09:00', 'Water sports at Calangute', 'Parasailing, jet ski, banana boat'),
  ('goa-north', 3, '15:00', 'Old Goa churches', 'Basilica of Bom Jesus and Se Cathedral'),
  ('goa-north', 3, '20:00', 'Dinner in Panjim''s Fontainhas', null),
  ('goa-north', 4, '10:00', 'Brunch and souvenir shopping', null),
  ('goa-north', 4, '13:00', 'Head home', null),
  -- South Goa, 3 nights
  ('goa-south', 0, '14:00', 'Check in near Palolem', null),
  ('goa-south', 0, '17:30', 'Sunset at Palolem beach', null),
  ('goa-south', 1, '08:00', 'Kayak to Butterfly beach', null),
  ('goa-south', 1, '13:00', 'Long lunch at Agonda', null),
  ('goa-south', 1, '20:00', 'Silent disco or a quiet dinner', null),
  ('goa-south', 2, '10:00', 'Cabo de Rama fort', null),
  ('goa-south', 2, '15:00', 'Cola beach and the lagoon', null),
  ('goa-south', 2, '19:30', 'Seafood dinner by the sea', null),
  ('goa-south', 3, '10:00', 'Morning swim and checkout', null),
  ('goa-south', 3, '12:00', 'Head home', null),
  -- Kerala classic, 5 nights
  ('kerala-classic', 0, '13:00', 'Arrive in Kochi, check in at Fort Kochi', null),
  ('kerala-classic', 0, '17:00', 'Chinese fishing nets at sunset', null),
  ('kerala-classic', 0, '19:30', 'Kathakali show', null),
  ('kerala-classic', 1, '09:00', 'Jew Town and Mattancherry Palace', null),
  ('kerala-classic', 1, '14:00', 'Drive up to Munnar', 'About 4 hours through the ghats'),
  ('kerala-classic', 2, '08:00', 'Tea gardens and the tea museum', null),
  ('kerala-classic', 2, '12:00', 'Eravikulam National Park', 'Look out for the Nilgiri tahr'),
  ('kerala-classic', 2, '16:00', 'Mattupetty dam and Echo Point', null),
  ('kerala-classic', 3, '09:00', 'Drive to Alleppey', null),
  ('kerala-classic', 3, '13:00', 'Board the houseboat', 'Lunch and dinner on board'),
  ('kerala-classic', 4, '09:00', 'Leave the houseboat, head to Marari beach', null),
  ('kerala-classic', 4, '17:00', 'Sunset at Marari', null),
  ('kerala-classic', 5, '10:00', 'Back to Kochi and fly home', null),
  -- Kerala backwaters, 3 nights
  ('kerala-backwaters', 0, '13:00', 'Arrive in Alleppey', null),
  ('kerala-backwaters', 0, '16:00', 'Canoe ride through the narrow canals', null),
  ('kerala-backwaters', 1, '12:00', 'Board the houseboat', null),
  ('kerala-backwaters', 1, '18:00', 'Sunset on Vembanad lake', null),
  ('kerala-backwaters', 2, '09:00', 'Check in at Marari beach', null),
  ('kerala-backwaters', 2, '16:00', 'Ayurvedic massage', null),
  ('kerala-backwaters', 3, '10:00', 'Head home', null),
  -- Jaipur and Udaipur, 5 nights
  ('rajasthan-royal', 0, '13:00', 'Arrive in Jaipur', null),
  ('rajasthan-royal', 0, '17:00', 'Hawa Mahal and the old city bazaars', null),
  ('rajasthan-royal', 0, '20:00', 'Dinner at Chokhi Dhani', null),
  ('rajasthan-royal', 1, '08:30', 'Amber Fort', null),
  ('rajasthan-royal', 1, '13:00', 'City Palace and Jantar Mantar', null),
  ('rajasthan-royal', 1, '18:00', 'Sunset at Nahargarh Fort', null),
  ('rajasthan-royal', 2, '09:00', 'Train or drive to Udaipur', 'About 6 hours'),
  ('rajasthan-royal', 2, '19:00', 'Rooftop dinner by Lake Pichola', null),
  ('rajasthan-royal', 3, '09:00', 'City Palace, Udaipur', null),
  ('rajasthan-royal', 3, '16:00', 'Boat ride on Lake Pichola', null),
  ('rajasthan-royal', 4, '09:00', 'Day trip to Kumbhalgarh Fort', null),
  ('rajasthan-royal', 4, '19:00', 'Folk dance at Bagore ki Haveli', null),
  ('rajasthan-royal', 5, '10:00', 'Head home', null),
  -- Udaipur, 3 nights
  ('rajasthan-udaipur', 0, '14:00', 'Arrive, check in near the lake', null),
  ('rajasthan-udaipur', 0, '18:00', 'Sunset at Ambrai Ghat', null),
  ('rajasthan-udaipur', 1, '09:30', 'City Palace', null),
  ('rajasthan-udaipur', 1, '16:00', 'Boat ride on Lake Pichola', null),
  ('rajasthan-udaipur', 1, '19:00', 'Folk dance at Bagore ki Haveli', null),
  ('rajasthan-udaipur', 2, '10:00', 'Saheliyon ki Bari and Fateh Sagar', null),
  ('rajasthan-udaipur', 2, '17:00', 'Sajjangarh Monsoon Palace for sunset', null),
  ('rajasthan-udaipur', 3, '10:00', 'Head home', null),
  -- Manali adventure, 4 nights
  ('manali-adventure', 0, '14:00', 'Arrive, check in at Old Manali', null),
  ('manali-adventure', 0, '18:00', 'Café hopping in Old Manali', null),
  ('manali-adventure', 1, '09:00', 'Solang Valley: paragliding and ropeway', null),
  ('manali-adventure', 1, '17:00', 'Mall Road walk', null),
  ('manali-adventure', 2, '08:00', 'Atal Tunnel and Sissu', 'Snow most of the year; check the road first'),
  ('manali-adventure', 3, '10:00', 'Hadimba temple and Vashisht hot springs', null),
  ('manali-adventure', 3, '14:00', 'River rafting on the Beas', null),
  ('manali-adventure', 3, '20:00', 'Bonfire dinner', null),
  ('manali-adventure', 4, '10:00', 'Head home', null),
  -- Manali and Kasol, 5 nights
  ('manali-kasol', 0, '14:00', 'Arrive in Manali', null),
  ('manali-kasol', 0, '18:00', 'Old Manali cafés', null),
  ('manali-kasol', 1, '09:00', 'Solang Valley', null),
  ('manali-kasol', 1, '16:00', 'Hadimba temple', null),
  ('manali-kasol', 2, '10:00', 'Drive to Kasol', 'About 3 hours'),
  ('manali-kasol', 2, '17:00', 'Riverside evening by the Parvati', null),
  ('manali-kasol', 3, '08:00', 'Hike to Chalal village', null),
  ('manali-kasol', 3, '15:00', 'Manikaran gurudwara and hot springs', null),
  ('manali-kasol', 4, '09:00', 'Day hike to Tosh', null),
  ('manali-kasol', 5, '10:00', 'Head home', null),
  -- Rishikesh rafting, 2 nights
  ('rishikesh-rafting', 0, '12:00', 'Check in at a riverside camp', null),
  ('rishikesh-rafting', 0, '16:00', 'Cliff jumping and beach volleyball', null),
  ('rishikesh-rafting', 0, '20:00', 'Bonfire at the camp', null),
  ('rishikesh-rafting', 1, '09:00', 'Rafting from Shivpuri', '16 km, grade III rapids'),
  ('rishikesh-rafting', 1, '15:00', 'Laxman Jhula and the cafés', null),
  ('rishikesh-rafting', 1, '18:00', 'Ganga aarti at Triveni Ghat', null),
  ('rishikesh-rafting', 2, '08:00', 'Bungee or the giant swing', 'Book ahead at Mohan Chatti'),
  ('rishikesh-rafting', 2, '13:00', 'Head home', null),
  -- Rishikesh calm, 3 nights
  ('rishikesh-calm', 0, '13:00', 'Check in near Tapovan', null),
  ('rishikesh-calm', 0, '18:00', 'Ganga aarti at Parmarth Niketan', null),
  ('rishikesh-calm', 1, '07:00', 'Morning yoga class', null),
  ('rishikesh-calm', 1, '11:00', 'Beatles Ashram', null),
  ('rishikesh-calm', 1, '16:00', 'Café afternoon by Ram Jhula', null),
  ('rishikesh-calm', 2, '08:00', 'Neer Garh waterfall', null),
  ('rishikesh-calm', 2, '17:00', 'Sunset at Kunjapuri temple', null),
  ('rishikesh-calm', 3, '10:00', 'Head home', null),
  -- Bali highlights, 6 nights
  ('bali-highlights', 0, '15:00', 'Arrive, check in at Ubud', null),
  ('bali-highlights', 0, '19:00', 'Dinner in Ubud town', null),
  ('bali-highlights', 1, '08:00', 'Tegallalang rice terraces', null),
  ('bali-highlights', 1, '12:00', 'Sacred Monkey Forest', null),
  ('bali-highlights', 1, '16:00', 'Ubud market and palace', null),
  ('bali-highlights', 2, '07:00', 'Tirta Empul water temple', null),
  ('bali-highlights', 2, '13:00', 'Tegenungan waterfall', null),
  ('bali-highlights', 3, '10:00', 'Move to Uluwatu', null),
  ('bali-highlights', 3, '17:00', 'Uluwatu temple and Kecak fire dance', null),
  ('bali-highlights', 4, '10:00', 'Padang Padang and Bingin beaches', null),
  ('bali-highlights', 4, '18:00', 'Seafood dinner at Jimbaran', null),
  ('bali-highlights', 5, '10:00', 'Surf lesson or a beach club', null),
  ('bali-highlights', 6, '10:00', 'Head home', null),
  -- Bali and Nusa Penida, 5 nights
  ('bali-nusa', 0, '15:00', 'Arrive, check in at Seminyak', null),
  ('bali-nusa', 0, '18:00', 'Sunset at a Seminyak beach club', null),
  ('bali-nusa', 1, '09:00', 'Canggu cafés and surf', null),
  ('bali-nusa', 1, '17:00', 'Tanah Lot at sunset', null),
  ('bali-nusa', 2, '07:00', 'Fast boat to Nusa Penida', null),
  ('bali-nusa', 2, '10:00', 'Kelingking beach and Broken beach', null),
  ('bali-nusa', 3, '09:00', 'Snorkel with manta rays', null),
  ('bali-nusa', 3, '16:00', 'Boat back to Bali', null),
  ('bali-nusa', 4, '08:00', 'Day in Ubud: rice terraces and monkey forest', null),
  ('bali-nusa', 5, '10:00', 'Head home', null),
  -- Phuket, 5 nights
  ('thailand-phuket', 0, '15:00', 'Arrive, check in at Kata or Karon', null),
  ('thailand-phuket', 0, '19:00', 'Night market dinner', null),
  ('thailand-phuket', 1, '10:00', 'Phuket Old Town', null),
  ('thailand-phuket', 1, '17:00', 'Sunset at Promthep Cape', null),
  ('thailand-phuket', 2, '07:30', 'Boat day to Phi Phi and Maya Bay', null),
  ('thailand-phuket', 3, '10:00', 'Big Buddha and a beach afternoon', null),
  ('thailand-phuket', 3, '21:00', 'Bangla Road night out', null),
  ('thailand-phuket', 4, '08:00', 'Phang Nga Bay and James Bond Island', null),
  ('thailand-phuket', 5, '10:00', 'Head home', null),
  -- Bangkok and Krabi, 6 nights
  ('thailand-bangkok-krabi', 0, '15:00', 'Arrive in Bangkok', null),
  ('thailand-bangkok-krabi', 0, '19:00', 'Street food in Chinatown', null),
  ('thailand-bangkok-krabi', 1, '08:30', 'Grand Palace and Wat Pho', null),
  ('thailand-bangkok-krabi', 1, '16:00', 'Wat Arun at sunset', null),
  ('thailand-bangkok-krabi', 1, '20:00', 'Rooftop bar', null),
  ('thailand-bangkok-krabi', 2, '09:00', 'Chatuchak market', 'Weekends; otherwise a floating market'),
  ('thailand-bangkok-krabi', 2, '17:00', 'Fly to Krabi, check in at Ao Nang', null),
  ('thailand-bangkok-krabi', 3, '08:00', 'Four islands longtail tour', null),
  ('thailand-bangkok-krabi', 4, '10:00', 'Railay beach and the viewpoint', null),
  ('thailand-bangkok-krabi', 5, '09:00', 'Emerald Pool and hot springs', null),
  ('thailand-bangkok-krabi', 6, '10:00', 'Head home', null),
  -- Da Nang and Hoi An, 5 nights
  ('vietnam-central', 0, '15:00', 'Arrive in Da Nang', null),
  ('vietnam-central', 0, '18:00', 'My Khe beach and seafood dinner', null),
  ('vietnam-central', 1, '08:00', 'Ba Na Hills and the Golden Bridge', null),
  ('vietnam-central', 1, '20:00', 'Dragon Bridge show', 'Weekends at 9 pm'),
  ('vietnam-central', 2, '09:00', 'Marble Mountains', null),
  ('vietnam-central', 2, '15:00', 'Move to Hoi An', null),
  ('vietnam-central', 2, '18:30', 'Lantern boat on the Thu Bon river', null),
  ('vietnam-central', 3, '09:00', 'Bike to the rice fields and An Bang beach', null),
  ('vietnam-central', 3, '15:00', 'Get clothes tailored in the old town', null),
  ('vietnam-central', 4, '08:00', 'Cooking class', null),
  ('vietnam-central', 4, '16:00', 'My Son sanctuary', null),
  ('vietnam-central', 5, '10:00', 'Head home', null),
  -- Hanoi, Ha Long, Ninh Binh, 6 nights
  ('vietnam-north', 0, '15:00', 'Arrive in Hanoi', null),
  ('vietnam-north', 0, '19:00', 'Old Quarter street food walk', null),
  ('vietnam-north', 1, '09:00', 'Hoan Kiem lake and the Temple of Literature', null),
  ('vietnam-north', 1, '19:00', 'Train Street coffee', null),
  ('vietnam-north', 2, '08:00', 'Drive to Ha Long Bay, board the cruise', null),
  ('vietnam-north', 2, '16:00', 'Kayaking among the islands', null),
  ('vietnam-north', 3, '07:00', 'Sunrise on deck, back to land', null),
  ('vietnam-north', 3, '16:00', 'Move to Ninh Binh', null),
  ('vietnam-north', 4, '08:00', 'Trang An boat ride', null),
  ('vietnam-north', 4, '15:00', 'Climb to Mua Cave viewpoint', null),
  ('vietnam-north', 5, '09:00', 'Back to Hanoi, egg coffee and shopping', null),
  ('vietnam-north', 6, '10:00', 'Head home', null),
  -- Dubai classic, 4 nights
  ('dubai-classic', 0, '15:00', 'Arrive and check in', null),
  ('dubai-classic', 0, '19:00', 'Dubai Mall and the fountain show', null),
  ('dubai-classic', 1, '09:00', 'Al Fahidi and an abra across the creek', null),
  ('dubai-classic', 1, '11:00', 'Gold and spice souks', null),
  ('dubai-classic', 1, '17:00', 'At the Top, Burj Khalifa', 'Book a sunset slot ahead'),
  ('dubai-classic', 2, '15:00', 'Desert safari with dune bashing and dinner', null),
  ('dubai-classic', 3, '10:00', 'JBR beach and Dubai Marina', null),
  ('dubai-classic', 3, '20:00', 'Dhow cruise dinner', null),
  ('dubai-classic', 4, '10:00', 'Head home', null),
  -- Dubai weekend, 2 nights
  ('dubai-weekend', 0, '14:00', 'Arrive and check in', null),
  ('dubai-weekend', 0, '17:00', 'At the Top, Burj Khalifa, and the fountains', null),
  ('dubai-weekend', 1, '10:00', 'Old Dubai souks and the creek', null),
  ('dubai-weekend', 1, '15:00', 'Desert safari', null),
  ('dubai-weekend', 2, '10:00', 'Pool or beach morning', null),
  ('dubai-weekend', 2, '14:00', 'Head home', null),
  -- Sri Lanka hills and coast, 6 nights
  ('srilanka-hills', 0, '14:00', 'Arrive, drive to Kandy', null),
  ('srilanka-hills', 0, '18:00', 'Temple of the Tooth', null),
  ('srilanka-hills', 1, '09:00', 'Royal Botanical Gardens', null),
  ('srilanka-hills', 1, '15:00', 'Kandy lake walk', null),
  ('srilanka-hills', 2, '08:30', 'Hill train from Kandy to Ella', 'Book reserved seats on the left side'),
  ('srilanka-hills', 3, '06:00', 'Little Adam''s Peak at sunrise', null),
  ('srilanka-hills', 3, '11:00', 'Nine Arch Bridge', null),
  ('srilanka-hills', 4, '09:00', 'Drive to Mirissa', null),
  ('srilanka-hills', 4, '17:00', 'Sunset at Coconut Tree Hill', null),
  ('srilanka-hills', 5, '10:00', 'Galle Fort', null),
  ('srilanka-hills', 6, '09:00', 'Head to the airport', null),
  -- Sri Lanka beaches, 4 nights
  ('srilanka-beaches', 0, '14:00', 'Arrive, check in at Mirissa', null),
  ('srilanka-beaches', 0, '18:00', 'Sunset at Coconut Tree Hill', null),
  ('srilanka-beaches', 1, '06:30', 'Whale watching', 'November to April'),
  ('srilanka-beaches', 1, '15:00', 'Secret beach', null),
  ('srilanka-beaches', 2, '10:00', 'Galle Fort walk', null),
  ('srilanka-beaches', 2, '17:00', 'Sunset on the ramparts', null),
  ('srilanka-beaches', 3, '09:00', 'Turtle hatchery and Unawatuna beach', null),
  ('srilanka-beaches', 4, '10:00', 'Head home', null);
