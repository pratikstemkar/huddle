# Day-by-day plan (Plan tab)

`/trip/<id>/plan`. It opens once the trip has dates: the locked dates, else fixed ones ([fixed-dates](fixed-dates.md)). Without dates: "The plan opens once the trip has dates. Pick them in Vote." and `Vote` (→ Vote → Dates); `Ask Pip` says `Pick the dates in Vote`.

With dates:

- Header `<trip> · <k> of <n> days planned` and "The plan".
- Day chips (a five-column grid up to 5 days, a scrolling row after): `<Weekday>, <Month> <day>, N plans`. Selected is iris, a day with plans has a border, an empty day is dashed. Today is selected when it's a trip day, else the first day.
- The day's plans by time: `<time>, <title>, <note · added by <who>>` (or `Added by <who>`; `you`, a name, or `Someone`). Rows are buttons (`Edit this plan`) for their author and organisers.
- Empty day: "Nothing planned for <Weekday> yet."
- `Add to <Weekday>` (also `Ask Pip`) → the plan-item sheet for the selected day.
- Pip: "Every day has something planned." or "<Saturday> is wide open." / "<A>, <B> and 1 more are wide open." + " Dashed days have nothing planned yet." Trips longer than 7 days name days by number ("Day 4 and 5 …").
- Plans that are no longer on the trip's dates (after an unlock and re-lock, or changed fixed dates): a row `N plans aren't on the new dates` that expands to list them with their date.

The Trip tab's Plan tile shows `<k> of <n> days planned`; Pip on a locked trip nudges "Day N is still empty. Want to add something?" with `Plan`.

## Plan-item sheet (`/trip/<id>/plan-item?day=<YYYY-MM-DD>` or `?item=<id>`)

"Add a plan" / "Edit plan": Day chips (labels `<Weekday>, <Month> <day>`), `Time` (typed: `9`, `930`, `9:30`, `18.15`, `6pm`) with `Set the time to 9:00` / `13:00` / `18:00`, `Title` (max 80), `Note` (max 200). The button is `Add to <Weekday>` or `Save changes`. Editing adds `Delete this plan` → `Delete “<title>” from the plan?` → `Yes, delete` (or `Keep it`).

Errors: "Pick one of the trip’s days.", "Enter a time like 9:30 or 18:00.", "Give the plan a title.", "Plans can only go on the trip's dates." (RLS), "Couldn't save the plan. Check your connection and try again." Blocked states: "This plan has been removed.", "Only the person who added this, or an organiser, can change it.", and the no-dates line.

## What the database enforces (`…_itinerary.sql`)

- `itinerary_items`: members read; members add, only on the trip's dates (`in_trip_dates`) and as themselves; the author or an organiser edits (still only onto the dates) and deletes (deleting works off the dates too).
- Only `day`, `start_time`, `title`, `note` are updatable. `created_by` is set null when the author deletes their account.
- On realtime; `trip_stats.planned_days` counts the trip's days with at least one item.

## Driving it

1. Sign in as Aarav → create `<PREFIX>plan` with `I already know`, tapping today and the day after tomorrow → `Go to the trip` → `Plan` tab. Header `· 0 of 3 days planned`; Pip "<A>, <B> and 1 more are wide open. Dashed days have nothing planned yet."
2. `Add to <today's weekday>` → URL `/trip/<id>/plan-item?day=<today>`. With `Time` and `Title` empty, the button shows "Enter a time like 9:30 or 18:00." (time is checked first). Type `930` in `Time`, `Sunset walk` in `Title` → `Add to <Weekday>` → back on Plan.
3. The row `9:30, Sunset walk, Added by you`; today's chip `…, 1 plan`; header `1 of 3 days planned`; the Trip tab tile reads the same.
4. DB (psql select): one `itinerary_items` row, `start_time = 09:30:00`, `created_by` = Aarav.
5. Click the row → "Edit plan" → `Set the time to 18:00` → `Save changes` → the row shows `18:00`. Click it again → `Delete this plan` → `Yes, delete` → the day is empty again.
6. RLS (supabase-js as Aarav): inserting a row on a day outside the dates fails; as Kabir (not a member) reading `itinerary_items` for the trip gets nothing.
7. Seeded check: Pondy as Aarav → Plan: `Pondy long weekend · 2 of 3 days planned`; day 1 lists `6:00, Sunrise at Rock Beach, Meet at the Gandhi statue · added by you` and `13:00, Lunch at Villa Shanti, Booked for 4 · added by Meera`.
8. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"` (items cascade).

## Gotchas

- Needs migration `20261124000000_itinerary.sql`; see SKILL.md for using an isolated stack.
- Times are floating (no time zone) and shown in 24-hour form.

Last proven: not yet.
