-- Editing your profile: a display name (1–40 characters) and a colour for your initials avatar.

alter table public.profiles
  add column avatar_color text check (avatar_color in ('sunset', 'lagoon', 'mango', 'plum', 'bougainvillea', 'sky'));

-- `not valid` so older long names (from Google/Apple) don't block the migration; every new write is checked.
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 40) not valid;

-- New sign-ups get a name that fits the limit.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(btrim(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Traveller'
    )), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Only your own name, photo and colour are editable; id and created_at stay put.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, avatar_color) on public.profiles to authenticated;
drop policy "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
