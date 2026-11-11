# Locked trip summary

A locked trip's page becomes a summary: hero with `Locked in`, a `Share plan` button, `Dates` (range + nights), `Destination` (photo, note, link), and `Who's going`. The invite card, `Mark my days`, `Suggest a place` and `Ready to decide?` are gone. On the trips list a locked card also shows its dates, and its accessibility label ends with them (`Pondy long weekend, locked in, Dec 21, 2026 – Dec 23, 2026`).

`Share plan` opens the share sheet on native. On web without the Web Share API it copies the text ("<name> is locked in on Huddle! <dates> · <place>") and shows `Copied!`.

## Driving it

Seeded trip `Pondy long weekend` (Aarav organiser, Meera member, invite `pondy27`, locked 40–42 days from seed time). A local DB seeded before this feature lacks it; run the last block of `supabase/seed.sql` or `bun run db:reset` (ask first).

1. Sign in as Aarav → home shows `Pondy long weekend, locked in, <dates>` → open it.
2. Page text: `Locked in`, `Share plan`, `Dates`, `2 nights`, `Pondicherry`, the note, `en.wikipedia.org ↗`, 2 members.
3. `Share plan` → `Copied!` appears.
4. The Places and Days screens are read-only for this trip (no vote buttons, no `Suggest a place`).

## Gotchas

- If the chosen destination row no longer exists (`locked_destination_id` was set null), the card says "The chosen place is no longer available."

Last proven: 2026-11-11 (Aarav on the seeded Pondy trip, web).
