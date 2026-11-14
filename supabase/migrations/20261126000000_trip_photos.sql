-- The trip album: photos everyone in the trip adds, in the private `trip-photos` bucket.
--
-- The app re-encodes each photo on the device (long edge at most 2048px, which also drops GPS data)
-- and makes a 512px-wide thumbnail, then uploads both:
--   <trip_id>/<photo_id>.jpg and <trip_id>/<photo_id>-thumb.jpg
-- and only then inserts the row. Members see the album through short-lived signed links.
--
-- Leaving a trip keeps your photos in it. Deleting your account deletes your rows here (cascade); the
-- app removes the files first, since the database can't remove storage files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

create table public.trip_photos (
  -- Made on the device, so the files can be uploaded under it before the row exists.
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  path text not null unique check (path ~ ('^' || trip_id::text || '/' || id::text || '\.jpg$')),
  thumb_path text not null unique check (thumb_path ~ ('^' || trip_id::text || '/' || id::text || '-thumb\.jpg$')),
  width int not null check (width > 0),
  height int not null check (height > 0),
  -- The day the photo was taken (from the photo, else the day it was added). Floating, no time zone.
  taken_on date not null,
  created_at timestamptz not null default now()
);

create index on public.trip_photos (trip_id, taken_on, created_at);
create index on public.trip_photos (uploaded_by);

alter table public.trip_photos enable row level security;

create policy "members see album" on public.trip_photos for select using (public.is_member(trip_id));
create policy "members add to album" on public.trip_photos for insert
  with check (uploaded_by = auth.uid() and public.is_member(trip_id));
create policy "remove own album photos" on public.trip_photos for delete
  using (public.is_member(trip_id) and (uploaded_by = auth.uid() or public.is_organiser(trip_id)));

-- Rows are added and removed, never edited.
grant select, insert, delete on public.trip_photos to authenticated;
revoke update on public.trip_photos from anon, authenticated;

-- Storage: photo_trip() (from the place-photos migration) reads the trip id from the first folder.
create policy "members see trip photos" on storage.objects for select
  using (bucket_id = 'trip-photos' and public.is_member(public.photo_trip(name)));

create policy "members add trip photos" on storage.objects for insert
  with check (
    bucket_id = 'trip-photos'
    and public.is_member(public.photo_trip(name))
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(-thumb)?\.jpg$'
  );

-- The uploader removes their own files (with the photo, after a failed upload, or before deleting
-- their account); organisers can remove any file in their trip (with the photo, or the whole trip).
create policy "remove own trip photos" on storage.objects for delete
  using (
    bucket_id = 'trip-photos'
    and (owner_id = auth.uid()::text or public.is_organiser(public.photo_trip(name)))
  );

alter publication supabase_realtime add table public.trip_photos;
