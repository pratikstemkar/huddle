# Leave a trip

Members open `Trip settings` (⋯ in the trip hero) → `Leave trip` → `Yes, leave trip` (or `Stay`). They land on `/` and the trip is gone from their list. Organisers don't get a leave button: the sheet says to delete the trip instead, because the database refuses to let the last organiser leave ("The last organiser cannot leave the trip").

## What the database does on leave (`…_leave_trip.sql`)

- Deletes the leaver's `availability` and `votes` rows for that trip, so they stop counting in overlap and vote totals.
- Places they suggested stay.
- Deleting a whole trip still works (the guard skips when the trip row is already gone).

## Driving it

1. Setup (not the thing under test): as Aarav create `<PREFIX>leave`, as Kabir `join_trip` with its code and insert one `availability` day.
2. In the browser sign in as Kabir (sign out Aarav first) → open the trip → `Trip settings` → `Leave trip` → `Yes, leave trip` → URL `/`, trip not listed.
3. Query the trip as Aarav: `trip_members` has only Aarav, `availability` is empty.
4. As Aarav, delete from `trip_members` his own row → error "The last organiser cannot leave the trip".
5. Cleanup: `db.mjs cleanup aarav@dev.test <PREFIX>`.

## Gotchas

- A full page reload of a deep link while signed in lands on `/sign-in?id=…` first; click the dev user again and you are sent to `/`. Use in-app navigation instead of `navigate` to a trip URL.
- After a migration, apply it to the local DB with `bunx supabase migration up` (no reset needed).

Last proven: 2026-11-11 (Kabir leave, guard as Aarav, DB rows).
