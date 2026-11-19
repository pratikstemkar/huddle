# Hangouts

A quick plan with one of my groups: dinner, coffee, a movie, drinks, games or a day out. Routes: `/new-hangout?group=<id>` (full-screen, two steps), `/hangout/<id>` (answer, or the locked summary) and `/hangout/<id>/lock` (organiser only).

**New hangout, step 1:** activity grid, optional name (the placeholder is the activity's default), optional Google Maps link (`Paste` reads the clipboard; only `https://` Google Maps links are accepted, the name comes from `/place/<name>/`), group chips with "N of M from <group>" and `Change` to leave people out for this hangout only, and `Find a time together` / `I'll pick it`.
**Step 2, find:** five days by Morning / Afternoon / Evening / Late (past cells are off), week arrows, `Add an exact time`, `Lasts about` 1 / 2 / 3 hrs / Open, "Answers close tomorrow, <time>", `Send N options to <group>`. **Step 2, set:** one day and one time, `Send the invite`.

**`/hangout/<id>`:** "Aarav invited College gang", the place with `Open in Maps`, one card per time with `Works` / `If needed` / `Can't` (answers save on tap; tapping the chosen one again clears it) and a `Best so far` badge. The organiser gets `Lock a time` and a two-step `Cancel hangout`. A locked hangout, or an `I'll pick it` one, shows a single time card ("N people are in", `I'm in` / `Can't` for set hangouts) and `Add to calendar` (an `.ics` download on web).
**`/hangout/<id>/lock`:** a bar per time (can / if needed / can't), `Most people` on the best one, who hasn't answered with `Nudge` (share sheet), `Lock in <day> <time>`.

Invitees are members straight away (no accept step). Hangouts I haven't answered show under "Waiting on you" on the Groups tab; every hangout of a group is listed on `/group/<id>`. Data: `hangouts`, `hangout_members`, `hangout_slots`, `hangout_answers`, `create_hangout`, `answer_hangout`, `lock_hangout`, `cancel_hangout`, `my_hangouts` (migration `…_hangouts.sql`).

## Driving it with the built-in browser

Needs an isolated stack (this feature ships a migration). Seed: Aarav asked College gang to **Dinner with the gang** (three evenings, Nori House); Meera has answered two times, Kabir none.

1. Sign in as Kabir → `Groups`: "Aarav asked when works for Dinner with the gang", `Answer`. Open it; `Works` on a time → `hangout_answers` has Kabir's row.
2. Sign in as Aarav → `/new-hangout?group=bbbbbbbb-0000-0000-0000-000000000001` → `Next: suggest times` → tap two Evening cells, `Add an exact time` (a day, `7 PM`, `Add this time`) → `Send 3 options to College gang` → lands on `/hangout/<id>` with `Lock a time`.
3. `Lock a time` → `Lock in <first time>` → back on the page showing "Locked in" and `Add to calendar`; `hangouts.status` is `locked` with `locked_slot_id` set, and answering is refused ("already settled").

## Cleanup

`db:reset` on the isolated stack restores the seed.

Last proven: 2026-11-19 on web against an isolated stack, as Meera (answer saved), Aarav (create, lock) and Kabir (waiting row). Not yet: `I'll pick it`, nudge, cancel, native.
