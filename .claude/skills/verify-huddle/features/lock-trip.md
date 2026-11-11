# Organiser locks the trip

On a planning trip the organiser sees a `Ready to decide?` card with `Lock in the plan`. It opens `/trip/[id]/lock` (form sheet): the best date ranges as radio chips (pre-selected: the first), `Start date` / `End date` fields (`YYYY-MM-DD`), a `Destination` radio list ranked by votes (pre-selected: the top one), and `Lock in the plan`. On success the sheet closes and the trip shows `Locked in`, the dates and the chosen place. Members never see the card; the sheet for a non-organiser says "Only the organiser can lock the trip."

## What the database enforces (`…_lock_trip.sql`)

- `lock_trip(t, start_day, end_day, destination)`: organiser only, not already locked, start ≤ end, destination belongs to the trip.
- Once locked, inserting days, places or votes is refused by RLS, and places can't be deleted.

## Driving it

1. Setup (not under test): Aarav creates `<PREFIX>lock`, Kabir joins, both add two destinations and overlapping days, Kabir votes.
2. Sign in as Aarav, open the trip, `Lock in the plan` (card) → sheet shows best range and top place → `Lock in the plan` (the sheet's button, the second match of `find`).
3. Trip page: `Locked in`, `Dates`, `Destination`; no `Ready to decide?` card.
4. As Kabir via supabase-js: `lock_trip` → "Only the organiser can lock the trip"; insert vote / destination / day → RLS violation; Aarav `lock_trip` again → "This trip is already locked".

## Gotchas

- Dates are typed as text (`YYYY-MM-DD`) for now; invalid or reversed dates show an inline error before any request.
- While the sheet is open the trip page's own `Lock in the plan` button is still in the accessibility tree, so `find` returns two buttons.

Last proven: 2026-11-11 (Aarav lock via UI, Kabir RLS checks).
