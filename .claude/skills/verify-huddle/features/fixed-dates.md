# Fixed dates

An organiser who already knows when the trip is sets the dates instead of a vote: `I already know` ("Set the dates yourself") in step 1 of a new trip, or in `Trip settings` → Dates on a planning trip. The trip still needs a place and still locks later; the lock sheet prefills these dates.

## The date range picker

One month at a time (`Previous month` is disabled on the current month, `Next month`), days as `<Weekday>, <Month> <day>` buttons, past days disabled. Tap the first day, then the last; the first tap already makes a one-day range. The caption reads "Tap the first day, then the last", then "<day>, now tap the last day", then the range. Picked days get `, first day` / `, last day` / `, in your dates`.

## What changes with fixed dates

- **Home:** the card shows the dates and a countdown tile; its chip skips "mark your days" (only a missing vote makes it `Your vote needed`, else `Planning days`). The hero's "still need to mark their days" nudge skips these trips.
- **Trip tab:** the beak-yellow countdown hero. Pip never asks you to mark days; the organiser gets `Lock` as soon as there's a place, and members who have voted get the empty-plan-days nudge.
- **Vote → Dates:** no calendar: "Dates are set", the range, "Set by you" / "Set by <organiser>", and for the organiser `Change in settings`.
- **Plan tab** opens on those days ([plan](plan.md)).
- **Lock sheet:** no best-range choices; `Start date` / `End date` are prefilled.
- **Settings → Dates:** `I already know` shows the picker with the saved range; changing it shows `Save dates`. Picking `Let the group vote` clears the dates at once. The section is hidden on locked trips.

"The trip's dates" everywhere is `coalesce(locked, fixed)`.

## What the database enforces (`…_fixed_dates_summaries.sql`)

- `trips.fixed_start` / `fixed_end`: both set or both null, end ≥ start (`trips_fixed_dates_check`). Only organisers can update trips.

## Driving it

1. Sign in as Aarav → `Pip: start a new trip` → name `<PREFIX>fixed` → `I already know`. Click `Next: invite people` with no day → "Pick the first and last day of the trip."
2. Tap a day next week, then one two days later → the caption shows the range → `Next: invite people` → `Go to the trip`.
3. Trip tab: `<n> days to go`. `Vote` → `Dates`: "Dates are set", "Set by you", `Change in settings`.
4. DB (psql select): `fixed_start` / `fixed_end` match; `status = planning`.
5. `Change in settings` → Dates → `Let the group vote` → back on Vote → Dates the calendar is back; DB `fixed_*` null.
6. Seeded check: as Kabir, `Udaipur in winter` → Vote → Dates says "Set by you"; as Zoya it says "Set by Kabir" with no settings link.
7. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

Last proven: not yet.
