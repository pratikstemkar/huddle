# Suggest a destination

`/trip/<id>/suggest` (sheet), opened from the **Where** card on trip detail (`Suggest a place`) or from the Places screen. Fields: `Place name` (required, max 80), `Note` (max 500), `Link`, and a photo (`Choose photo`, plus `Take photo` on iOS/Android). Links get `https://` added when missing; anything that isn't a web link shows `That doesn't look like a web link.` and nothing is saved. A chosen photo is centre-cropped to 16:9 and resized to 1600×900 JPEG, then shown as `Photo preview` with `Change photo` / `Remove photo`. Locked trips don't offer the button on Places.

## Driving it

1. As a member, trip detail → `Suggest a place`.
2. Fill `Place name` and an invalid `Link` (`not a link`) → `Add place` → error text, still on `/suggest`.
3. Fix the link (`en.wikipedia.org/wiki/Palolem`) → `Add place` → back on trip detail; Where card lists the place with `0`.
4. DB: `destinations` row has `url = https://en.wikipedia.org/wiki/Palolem`.
5. RLS: a non-member reading `destinations` gets no rows.

### With a photo

Needs an **isolated Supabase** (the `place-photos` bucket comes from a migration). The browser pane can't drive a native file chooser: build a test image on a canvas with `javascript_tool`, press `Choose photo`, then set it on the `input[type=file]` the picker appended and dispatch `change`.

1. `Photo preview` appears; its `<img>` is 1600×900.
2. `Add place` → `destinations.image_path = <trip_id>/<place_id>.jpg`, and `storage.objects` has that name as `image/jpeg`.
3. Places shows `Photo of <name>` from a `/storage/v1/object/sign/place-photos/…` link; the home trip card shows it as the cover (`trip_covers` view).
4. RLS (supabase-js as each user): a member can sign/download it and upload into the trip; a non-member can't sign, download, upload or delete; nobody can upload into a locked trip; a member can't delete someone else's photo.
5. `Remove <name>` → the row, the stored photo and the cover are gone.

## Gotchas

- Migration `20261112000000_destination_checks` also enforces the link/length limits in the database.
- Older places may still have `image_url` (a pasted web link); cards and covers show it when there's no uploaded photo.
- The device copy (`<documents>/huddle/trips/<trip_id>/places/<place_id>.jpg`) and `Take photo` are native-only and need a development build; web relies on the browser cache.

Last proven: 2026-11-14 (photo upload, cover, RLS as Meera and Kabir, removal; web only).
