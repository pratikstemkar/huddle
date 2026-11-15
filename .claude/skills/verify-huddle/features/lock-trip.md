# Organiser locks the trip

On a planning trip with at least one place and some dates (best days or fixed dates), the organiser's Pip says "Looks like <place> on <range>. Ready to lock it in?" with `Lock` (accessibility label `Lock in the plan`). `Trip settings` → Plan → `Lock in the plan` opens the same sheet at any time.

`/trip/<id>/lock` ("Lock in the plan" sheet): "Everyone sees the final dates and place. Days and votes stop changing." **When:** the best ranges as radios (`<range>, N of M free`, first one pre-selected; none for fixed dates, which prefill the fields instead), and `Start date` / `End date` text fields (`YYYY-MM-DD`). **Where:** places as radios (`<title>, N votes`, `Leading` badge, top one pre-selected), or "Suggest at least one place first, then come back to lock the trip." Then `Lock in the plan`. On success the sheet is replaced by the celebration screen ([locked-celebration](locked-celebration.md)), and the Trip tab shows the locked summary.

Members never see Pip's lock button; the sheet for a non-organiser says "Only the organiser can lock the trip.", for a locked trip "This trip is already locked in."

## What the database enforces (`…_lock_trip.sql`)

- `lock_trip(t, start_day, end_day, destination)`: organiser only, not already locked, start ≤ end, destination belongs to the trip.
- Once locked, inserting days, places or votes is refused by RLS, and places can't be deleted.

## Driving it

1. Setup (not under test): Aarav creates `<PREFIX>lock`, Kabir joins, both add overlapping days, Aarav adds two places, Kabir votes.
2. Sign in as Aarav, open the trip → Pip shows `Lock` → click `Lock in the plan` → URL `/trip/<id>/lock`; the best range and top place are selected.
3. Clear `End date`, type `2027-02-31` → `Lock in the plan` (the sheet's footer button) → "Enter both dates as YYYY-MM-DD, for example 2027-03-14." Put a valid end date back.
4. `Lock in the plan` → URL `/trip/<id>/locked`, "It's official", "<place>, here we come!". `Close` → the Trip tab shows the locked summary.
5. As Kabir via supabase-js: `lock_trip` → "Only the organiser can lock the trip"; insert vote / destination / day → RLS violation; Aarav `lock_trip` again → "This trip is already locked".
6. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- `find "Lock in the plan"` also matches the sheet title and, while the sheet is over the trip, the Pip button underneath. Pick the last `button` match.
- Dates are typed as text; invalid or reversed dates show an inline error before any request.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-11).
