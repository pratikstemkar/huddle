# Nudge people

Two buttons ask the server to nudge the people who still need to act (`nudge_trip(t, what)` in `…_notifications.sql`, called through `nudgeTrip` in `src/lib/activity.ts`). The server picks the recipients, so the sender only ever learns a count, never names (hidden marking stays hidden). Each recipient gets an Activity item and, on a phone with push on, a push. A trip gets at most one nudge per kind every 20 hours; any member can send it.

1. **Home hero** (people haven't marked days): on a planning trip with 2+ members and no fixed dates where someone hasn't marked, Pip says "<k> of <n> still need to mark their days for <trip>." and `Nudge them` → toast `Nudged <k> people.` and the button turns into a disabled `Nudged today`. Opens `/trip/<id>/vote?seg=dates` when tapped in Activity.
2. **Trip tab Pip** (people haven't voted): "Waiting on <k> more to vote." and `Nudge` → toast `Nudged <k> people.`; opens `/trip/<id>/vote?seg=places`.

A second press the same day: toast `Everyone was nudged about this today already. Try again tomorrow.` (rows in `trip_nudges`).

## Driving it with the built-in browser

Needs the notifications migration: use an isolated stack until it is on `main` (see [notifications](notifications.md)).

1. Sign in as Kabir → Hampi (`/trip/aaaaaaaa-…-000000000003`) → suggest `<PREFIX>place` and vote for it → Trip tab → Pip says "Waiting on 2 more to vote." → `Nudge` → toast `Nudged 2 people.` → `Nudge` again → the "today already" toast.
2. Read the rows: `select user_id, kind, url, push_status from notifications where kind = 'nudge_vote'` → Aarav and Meera, never Kabir.
3. Cleanup: delete the `<PREFIX>` place (isolated stack).

## Not covered here

Push delivery to a phone needs a development build (see [notifications](notifications.md)).

Last proven: 2026-11-21 (web, isolated stack, Trip tab Pip).
