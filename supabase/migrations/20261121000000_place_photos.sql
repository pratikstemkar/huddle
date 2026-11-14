-- Photos for suggested places, stored in Supabase Storage.
--
-- The app crops and resizes each photo on the device (16:9, 1600x900 JPEG) before uploading it to the
-- private `place-photos` bucket at `<trip_id>/<destination_id>.jpg`. Only members of that trip can see
-- the photos; the app shows them through short-lived signed links.

-- Where the place's photo lives in the bucket. `image_url` stays for places added with a web link.
alter table public.destinations
  add column image_path text,
  add constraint destinations_image_path_check check (
    image_path is null or image_path ~ ('^' || trip_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The trip a photo belongs to: the first folder of its path. Null for anything that isn't a trip id,
-- so a malformed path fails the policies below instead of erroring.
create function public.photo_trip(name text) returns uuid
language sql immutable set search_path = public as $$
  select case
    when split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(name, '/', 1)::uuid
  end;
$$;

create policy "members see place photos" on storage.objects for select
  using (bucket_id = 'place-photos' and public.is_member(public.photo_trip(name)));

create policy "members add place photos" on storage.objects for insert
  with check (
    bucket_id = 'place-photos'
    and public.is_member(public.photo_trip(name))
    and not public.is_locked(public.photo_trip(name))
  );

-- The uploader removes their own photo (with their place, or when saving the place failed);
-- organisers can remove any photo in their trip, as they can any place.
create policy "remove own place photos" on storage.objects for delete
  using (
    bucket_id = 'place-photos'
    and (owner_id = auth.uid()::text or public.is_organiser(public.photo_trip(name)))
  );

-- One cover picture per trip for the home screen: the locked place's photo, otherwise the most-voted
-- place that has one (oldest first among ties). Runs as the caller, so members only see their own trips.
create view public.trip_covers with (security_invoker = true) as
select distinct on (d.trip_id) d.trip_id, d.image_path, d.image_url
from public.destinations d
join public.trips t on t.id = d.trip_id
left join (select destination_id, count(*) as n from public.votes group by destination_id) v on v.destination_id = d.id
where d.image_path is not null or d.image_url is not null
order by d.trip_id, (d.id = t.locked_destination_id) is true desc, coalesce(v.n, 0) desc, d.created_at, d.id;

grant select on public.trip_covers to authenticated;
