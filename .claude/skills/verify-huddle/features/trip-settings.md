# Trip settings: rename or delete (organiser)

On a trip the organiser sees a `Trip settings` (⋯) button in the hero, next to the status pill. It opens `/trip/[id]/settings` (form sheet): a `Trip name` field with `Save name`, and a danger zone with `Delete trip`. Members don't see the button; opening the URL directly shows "Only the organiser can change this trip."

## Sub-features

- Rename: saves, closes the sheet, the trip hero shows the new name. Empty → "Give your trip a name first."
- Delete is two steps: `Delete trip` → `Yes, delete forever` (or `Keep trip`). On success you land on `/`, and the trip is gone from the list.
- Anyone else looking at the trip when it is deleted is sent to `/` (live, via `useTripLive`).

## Driving it

1. Sign in as Aarav, `New trip`, name it `<PREFIX>settings`, open it from the list.
2. `Trip settings` → `Trip name` → select all, type `<PREFIX>renamed` → `Save name` → trip hero shows the new name.
3. `Trip settings` → `Delete trip` → `Yes, delete forever` → URL `/`.
4. `db.mjs trips aarav@dev.test` no longer lists it.

## Gotchas

- `.env.local` may point at a LAN IP, which `db.mjs` refuses. Run it with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- Stacked screens (trip page + settings) each subscribe to realtime; `useTripLive` gives every subscription its own channel name, otherwise supabase-js throws "cannot add postgres_changes callbacks after subscribe()".
- RLS hides rows you can't delete instead of erroring, so `deleteTrip` checks that a row came back.

Last proven: 2026-11-11 (Aarav rename + delete, DB rows).
