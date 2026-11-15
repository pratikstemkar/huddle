# Suggest a destination

`/trip/<id>/suggest` ("Suggest a place" sheet), opened from `Suggest a place` under the list in Vote → Places, `Ask Pip` on that segment, or Pip's `Suggest` on the Trip tab when there are no places. Fields: `Place name` (label "Name", required, max 80), `Note` ("Note (optional)", max 500), `Link` ("Link (optional)"), and "Photo (optional)" with `Choose photo` (plus `Take photo` on iOS/Android). Links get `https://` added when missing; anything that isn't a web link shows "That doesn't look like a web link." and nothing is saved. An empty name shows "Give the place a name first." A chosen photo is centre-cropped to 16:9 and resized to 1600×900 JPEG ("Preparing photo…"), then shown as `Photo preview` with `Change photo` / `Remove photo`. The button reads `Add place` (`Uploading photo…` while it uploads). Locked trips don't offer the button.

## Driving it

1. As a member of a `PREFIX` trip → `Vote` tab → `Suggest a place`.
2. Fill `Place name` and an invalid `Link` (`not a link`) → `Add place` → the link error, still on `/suggest`.
3. Fix the link (`en.wikipedia.org/wiki/Palolem`) → `Add place` → back on Vote → Places; the place is listed with 0 votes.
4. DB: the `destinations` row has `url = https://en.wikipedia.org/wiki/Palolem`.
5. RLS: a non-member reading `destinations` gets no rows.

### With a photo

Needs an **isolated Supabase** if the shared one lacks the `place-photos` bucket. The browser pane can't drive a native file chooser: build a test image on a canvas with `javascript_tool`, press `Choose photo`, then set it on the `input[type=file]` the picker appended and dispatch `change`.

1. `Photo preview` appears; its `<img>` is 1600×900.
2. `Add place` → `destinations.image_path = <trip_id>/<place_id>.jpg`, and `storage.objects` has that name as `image/jpeg`.
3. The card shows `Photo of <name>` from a `/storage/v1/object/sign/place-photos/…` link; the home card uses it as the tile (`trip_covers` view) while the trip has no countdown.
4. RLS (supabase-js as each user): a member can sign/download it and upload into the trip; a non-member can't sign, download, upload or delete; nobody can upload into a locked trip; a member can't delete someone else's photo.
5. `Remove <name>` → the row, the stored photo and the cover are gone.

## Gotchas

- Migration `20261112000000_destination_checks` also enforces the link/length limits in the database.
- Older places may still have `image_url` (a pasted web link); cards and covers show it when there's no uploaded photo.
- The device copy (`<documents>/huddle/trips/<trip_id>/places/<place_id>.jpg`) and `Take photo` are native-only and need a development build; web relies on the browser cache.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-14, photo upload, cover, RLS, removal; web only).
