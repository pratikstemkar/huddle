# Organiser unlocks a trip

On a locked trip the organiser's `Trip settings` (⋯ in the trip hero) shows a **Plan** section: `Unlock and re-plan` → `Yes, unlock` (or `Keep it locked`). The sheet closes and the trip is back to `Planning`, with the `Ready to decide?` card showing again. Members never see the section.

## What the database does (`…_organiser_tools.sql`)

- `unlock_trip(t)`: organiser only ("Only the organiser can unlock the trip"), trip must be locked ("This trip is not locked").
- Sets `status = 'planning'` and clears `locked_start`, `locked_end`, `locked_destination_id`. Days, places and votes are kept.

## Driving it

1. Setup (not under test), via supabase-js as the users: Aarav creates `<PREFIX>fix`, Kabir joins and marks a day, Aarav adds a place, Kabir votes, Aarav `lock_trip`s it.
2. Sign in as Aarav → open the trip → `Trip settings` → `Unlock and re-plan` → `Yes, unlock`.
3. Trip card says `still planning`; trip page shows `Ready to decide?` and the kept day and vote counts.
4. DB: `status = planning`, `locked_*` null, availability/votes unchanged.
5. As Kabir (member) `unlock_trip` → error; as Aarav on an unlocked trip → error.
6. Cleanup: `db.mjs cleanup aarav@dev.test <PREFIX>`.

## Gotchas

- `.env.local` may point `EXPO_PUBLIC_SUPABASE_URL` at a LAN IP for phone testing; `db.mjs` refuses it. Prefix helper calls with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (process env wins over `--env-file`).

Last proven: 2026-11-12 (Aarav unlock via UI, DB row, member/not-locked errors in SQL).
