# Trip settings (organiser)

The `Trip settings` row at the bottom of the Trip tab opens `/trip/[id]/settings` ("Trip settings" sheet). Organisers get these sections:

- **Trip:** `Trip name` (max 60) with `Save name`, and Colour radios (`Iris` … `Coral`) that save as soon as one is tapped.
- **Dates** (planning trips only): `Let the group vote` / `I already know` with the date range picker and `Save dates` ([fixed-dates](fixed-dates.md)).
- **Plan:** `Lock in the plan` ([lock-trip](lock-trip.md)), or on a locked trip `Unlock and re-plan` ([unlock-trip](unlock-trip.md)).
- **Privacy:** `Show who marked each day` ([hide-who-marked](hide-who-marked.md)).
- **People:** every member with `(you)`, an `Organiser` badge or `Remove <name>` ([remove-member](remove-member.md)).
- **Danger zone:** `Delete trip` → `Delete "<name>" for everyone?` → `Yes, delete forever` (or `Keep trip`).

Members get "Only <organiser> can change this trip." and a Leave section ([leave-trip](leave-trip.md)).

## Sub-features

- Rename: saves and closes the sheet; the Trip tab shows the new name. Empty → "Give your trip a name first."
- Colour: the swatch changes at once; a failure shows "Couldn't change the colour. Check your connection and try again."
- Delete: removes the trip's place photos and album files from storage first (`removeTripPhotos`), then the trip (days, places, votes, plans, expenses, settlements and album rows cascade). You land on `/` and the trip is gone.
- Anyone else looking at the trip when it is deleted is sent to `/` (live, via `useTripLive`).
- Opening the URL for a trip you're not in: "This trip doesn't exist, or you're not a member of it."

## Driving it

1. Sign in as Aarav, create `<PREFIX>settings` ([create-trip](create-trip.md)) and `Go to the trip`.
2. `Trip settings` → triple-click `Trip name`, type `<PREFIX>renamed` → `Save name` → the Trip tab shows the new name.
3. `Trip settings` → `Coral` → the radio is selected; `db.mjs trips aarav@dev.test` shows `color: "coral"`.
4. `Delete trip` → `Yes, delete forever` → URL `/`; `db.mjs trips aarav@dev.test` no longer lists it.

## Gotchas

- The Danger zone text still says deleting removes "the trip, days, places and votes"; plans, expenses and photos go too.
- `.env.local` may point at a LAN IP, which `db.mjs` refuses. Run it with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- RLS hides rows you can't delete instead of erroring, so `deleteTrip` checks that a row came back.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-11).
