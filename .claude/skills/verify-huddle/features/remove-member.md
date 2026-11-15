# Organiser removes a member

The organiser's `Trip settings` lists every person under **People**: "Removing someone clears their free days and votes. Places they suggested stay." Organisers have an `Organiser` badge; each member has `Remove` (`Remove <name>`) → `Remove <name> from the trip?`, their open balance if any ("<name> still owes ₹…. It stays on the trip's Split."), then `Yes, remove <name>` (or `Cancel`). The person disappears from the list and the header faces. Members never see the section.

## What the database does (`…_organiser_tools.sql`)

- Delete policy "organisers remove members" on `trip_members`: `role = 'member' and is_organiser(trip_id)`. Organisers can't be removed by others; a member deleting someone else removes nothing.
- The `clear_leaver_data` trigger deletes the removed person's `availability` and `votes` for the trip. Places, plans, expenses and photos they added stay.
- The removed person can rejoin with the invite code (no code reset yet).

## Driving it

1. Setup as in [unlock-trip](unlock-trip.md) (Kabir joined, a day and a vote).
2. As Aarav → trip → `Trip settings` → `Remove Kabir` → `Yes, remove Kabir`; People now lists only `Aarav (you)` with `Organiser`.
3. DB as Aarav: `trip_members` is only Aarav; Kabir's days and votes are gone; the place stays.
4. RLS: `db.mjs trips kabir@dev.test` no longer lists the trip.
5. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-12).
