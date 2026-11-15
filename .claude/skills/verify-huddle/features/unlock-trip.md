# Organiser unlocks a trip

On a locked trip the organiser's `Trip settings` shows, under **Plan**: "Locked in by mistake, or plans changed? …" and `Unlock and re-plan` → `Unlock "<trip>" and re-plan?` → `Yes, unlock` (or `Keep it locked`). The sheet closes and the trip is back to planning: no locked summary, the hero shows best days again, and Pip can offer `Lock`. Members never see the section.

Unlocking also forgets this device's "celebration seen" flag for the trip, so the next lock shows the celebration again ([locked-celebration](locked-celebration.md)). Plan items stay; any that fall outside the next dates are listed as "N plans aren't on the new dates" on the Plan tab ([plan](plan.md)).

## What the database does (`…_organiser_tools.sql`)

- `unlock_trip(t)`: organiser only ("Only the organiser can unlock the trip"), trip must be locked ("This trip is not locked").
- Sets `status = 'planning'` and clears `locked_start`, `locked_end`, `locked_destination_id`. Days, places and votes are kept.

## Driving it

1. Setup (not under test), via supabase-js as the users: Aarav creates `<PREFIX>fix`, Kabir joins and marks a day, Aarav adds a place, Kabir votes, Aarav `lock_trip`s it.
2. Sign in as Aarav → open the trip (`Close` the celebration) → `Trip settings` → `Unlock and re-plan` → `Yes, unlock`.
3. The home card no longer has the trip's dates; the Trip tab has no `Share plan`, and the Vote tile shows the leader again.
4. DB: `status = planning`, `locked_*` null, availability/votes unchanged.
5. As Kabir (member) `unlock_trip` → error; as Aarav on an unlocked trip → error.
6. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- `.env.local` may point `EXPO_PUBLIC_SUPABASE_URL` at a LAN IP for phone testing; `db.mjs` refuses it. Prefix helper calls with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (process env wins over `--env-file`).

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-12).
