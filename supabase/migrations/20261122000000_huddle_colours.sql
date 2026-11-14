-- The Huddle redesign has five trip colours: iris, beak, mint, blush and coral.
-- Old keys are remapped (sunset -> coral, lagoon -> mint, mango -> beak, plum -> iris,
-- bougainvillea -> blush, sky -> iris), for trips and for profile avatar colours.
--
-- Installed apps and older over-the-air bundles still send the old keys, so a trigger rewrites them
-- on every insert and update instead of letting the new check reject the write.

-- The new key for a colour. New keys, null and anything unknown pass through unchanged, so an unknown
-- key still fails the check below.
create function public.huddle_colour(c text) returns text
language sql immutable set search_path = public as $$
  select case c
    when 'sunset' then 'coral'
    when 'lagoon' then 'mint'
    when 'mango' then 'beak'
    when 'plum' then 'iris'
    when 'bougainvillea' then 'blush'
    when 'sky' then 'iris'
    else c
  end;
$$;

alter table public.trips drop constraint trips_color_check;
alter table public.profiles drop constraint profiles_avatar_color_check;

update public.trips set color = public.huddle_colour(color) where color is distinct from public.huddle_colour(color);
update public.profiles set avatar_color = public.huddle_colour(avatar_color)
 where avatar_color is distinct from public.huddle_colour(avatar_color);

alter table public.trips
  add constraint trips_color_check check (color in ('iris', 'beak', 'mint', 'blush', 'coral'));
alter table public.trips alter column color set default 'iris';
alter table public.profiles
  add constraint profiles_avatar_color_check check (avatar_color in ('iris', 'beak', 'mint', 'blush', 'coral'));

-- Check constraints run after BEFORE triggers, so a legacy key is rewritten before it is checked.
create function public.trips_legacy_colour() returns trigger
language plpgsql set search_path = public as $$
begin
  new.color := huddle_colour(new.color);
  return new;
end $$;

create trigger trips_legacy_colour
  before insert or update of color on public.trips
  for each row execute function public.trips_legacy_colour();

create function public.profiles_legacy_colour() returns trigger
language plpgsql set search_path = public as $$
begin
  new.avatar_color := huddle_colour(new.avatar_color);
  return new;
end $$;

create trigger profiles_legacy_colour
  before insert or update of avatar_color on public.profiles
  for each row execute function public.profiles_legacy_colour();
