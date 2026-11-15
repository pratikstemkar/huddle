# Trip album (Photos tab)

`/trip/<id>/photos`: header `<trip> · <n> photos from <k> people` (or `· No photos yet`), "Photos" and `Add` (`Add photos`, also `Ask Pip`). Pull to refresh works here.

- No photos: Pip, "No photos yet. Add the first and everyone gets the full album." and `Add yours`.
- With photos: chips `All`, `Day N` (only days of the trip that have photos) and `Mine`; a two-column masonry grid of thumbnails, each `Photo, <who>[ · Day N]` (`You` for mine); an `Add yours` tile in the shorter column; and Pip: "<name> hasn't added any photos yet. Everyone gets the full album." / "<A> and <B> haven't…" / "<A>, <B> and N more haven't…" / "Everyone's added photos. N and counting."
- While uploading: `Uploading <i> of <n>`. Afterwards, failures: "Couldn't add that photo. Check your connection and try again.", "Couldn't add those N photos…", "<k> of <n> photos couldn't be added. The rest are in the album."
- On native `Add` asks `Choose from library` / `Take a photo`; web goes straight to the file picker. Up to 10 photos per pick.

Each photo is re-encoded on the device as JPEG (long edge ≤ 2048px, which drops EXIF and GPS) plus a 512px-wide thumbnail, uploaded to `trip-photos/<trip_id>/<photo_id>.jpg` and `…-thumb.jpg`, then the row is inserted. `taken_on` comes from the photo's EXIF date, else today (web photos usually have no EXIF).

## Viewer (`/trip/<id>/photo/<photoId>?filter=<chip>`)

Full screen, black. `Close`, `<i> / <n>` (`Photo <i> of <n>`), swipe between the photos of the chosen chip (`Previous photo` / `Next photo` on web), the caption `<who> · Day N · <d Mon>`, and `Delete photo` for the uploader and organisers → confirm "Delete this photo? It's removed for everyone on the trip." Deleting the last one closes the viewer; a missing photo says "This photo isn't in the album any more."

The Trip tab's Photos tile shows `<n> so far` / `None yet`. A trip whose dates are over gets the `Done · N photos` chip on home, and Pip nudges "Add your photos so everyone gets the full album." if you haven't.

## What the database enforces (`…_trip_photos.sql`)

- `trip_photos`: members read; members insert as themselves; the uploader or an organiser deletes; no updates. `path` / `thumb_path` must match `<trip_id>/<id>.jpg` / `-thumb.jpg`.
- Private `trip-photos` bucket (JPEG only, 8 MB): members read and upload into their trip's folder; the file's owner or a trip organiser deletes.
- Leaving keeps your photos. Deleting your account deletes your rows (the app removes the files first); deleting a trip removes its folder first (`removeTripPhotos`).

## Driving it

Needs migration `20261126000000_trip_photos.sql` (the bucket and table); see SKILL.md for an isolated stack.

1. Sign in as Aarav → create `<PREFIX>photos` with `I already know` starting today → `Go to the trip` → `Photos` tab → the empty state.
2. The browser pane can't drive a native file chooser: build a test image on a canvas with `javascript_tool`, press `Add yours`, then set the file on the `input[type=file]` the picker appended and dispatch `change` (as in [suggest-destination](suggest-destination.md)).
3. `Uploading 1 of 1`, then a tile `Photo, You · Day 1`; chips `All`, `Day 1`, `Mine`; header `<PREFIX>photos · 1 photo from 1 person`; Pip "Everyone's added photos. 1 and counting."
4. DB (psql select): a `trip_photos` row with `taken_on` = today, `uploaded_by` Aarav; `storage.objects` has both paths in `trip-photos`.
5. Click the tile → URL `/trip/<id>/photo/<photoId>?filter=all`, caption `You · Day 1 · <today>`. `Delete photo` → accept → back on Photos, empty again; both storage objects are gone.
6. RLS (supabase-js): Kabir (not a member) reads no rows and can't sign the file; after Kabir joins, he can read and sign it but deleting Aarav's photo removes nothing.
7. Cleanup: delete any remaining photos in the app, or delete the trip from `Trip settings` (that removes the files); `db.mjs cleanup` alone leaves storage files behind.

## Gotchas

- `Take a photo`, EXIF dates and the native action sheet need a development build.
- Thumbnails and full photos are signed links that expire; a long-open tab may need a refresh.

Last proven: not yet.
