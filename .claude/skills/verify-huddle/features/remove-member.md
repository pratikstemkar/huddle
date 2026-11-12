# Organiser removes a member

The organiser's `Trip settings` lists every member (not organisers) under **Members**, each with a `Remove <name>` button → `Yes, remove <name>` (or `Cancel`). The person disappears from the list and from `Who's going`. Members never see the section.

## What the database does (`…_organiser_tools.sql`)

- Delete policy "organisers remove members" on `trip_members`: `role = 'member' and is_organiser(trip_id)`. Organisers can't be removed by others; a member deleting someone else removes nothing.
- The existing `clear_leaver_data` trigger deletes the removed person's `availability` and `votes` for the trip. Places they suggested stay.
- The removed person can rejoin with the invite code (no code reset yet).

## Driving it

1. Setup as in [unlock-trip](unlock-trip.md) (Kabir joined, a day and a vote).
2. As Aarav → trip → `Trip settings` → `Remove Kabir` → `Yes, remove Kabir`; the Members section disappears when nobody is left to remove.
3. DB as Aarav: `trip_members` is only Aarav; Kabir's days and votes are gone; the place stays.
4. RLS: `db.mjs trips kabir@dev.test` no longer lists the trip.
5. Cleanup: `db.mjs cleanup aarav@dev.test <PREFIX>`.

Last proven: 2026-11-12 (Aarav removes Kabir via UI, DB rows, RLS as Kabir).
