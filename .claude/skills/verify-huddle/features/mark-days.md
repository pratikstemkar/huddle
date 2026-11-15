# Mark my free days

Vote tab → `Dates` segment (`/trip/<id>/vote?seg=dates`; the old `/trip/<id>/days` redirects here). Header: `<trip> · <k> of <n> marked` and "When can we go?". In `My days` (the default) tapping a day marks or clears it as free for you; "Tap the days you could go." The calendar shows one month at a time, from this month to 4 months ahead; swipe or use `Previous month` / `Next month`, and `Back to this month` (shown as `Today`) jumps back.

Entry points: the Trip tab hero when the trip has no dates, Pip's `Mark days`, the `Dates` segment, and `Ask Pip` on that segment (`Mark my days`, which switches to My days).

## Sub-features

- Tap saves at once (optimistic), then writes one `availability` row (insert on mark, delete on clear). A failed save rolls the day back and shows "Couldn't save that day. Check your connection and try again."
- Past days and days beyond the window are disabled (`not available` in their label).
- Locked trips are read-only: no segment toggle, "Locked in. Dates are set.", Everyone view only.
- Trips with fixed dates have no calendar here: "Dates are set" ([fixed-dates](fixed-dates.md)).
- Under the grid: `N days marked this month` or `No days marked this month`.
- Pip at the bottom: "<k> of <n> have marked their days. Best so far: <range>."
- Refetches on focus and live.

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Places` / `Dates` | tab (segment) |
| `My days` / `Everyone` | tab |
| `<Weekday>, <Month> <day>` (e.g. `Saturday, November 21`) | button per day; gains `, you are free` once marked and `, N of M free` when anyone is |
| `Previous month` / `Next month` / `Back to this month` | button |

1. Create a `PREFIX` trip with `Let the group vote` ([create-trip](create-trip.md)), `Go to the trip`, then tap the hero (`When can you go?`) → URL `/trip/<id>/vote?seg=dates`.
2. Click two days; `find` shows `you are free` on both; the kicker reads `· 1 of 1 marked`. Click one again → its label loses it.
3. Check rows: the day values match, and only your user id is on them (`availability` select as that user).
4. Click `Next month`: the heading changes and next month's days can be clicked.
5. Cleanup: `db.mjs cleanup <email> "$PREFIX"`.

## Gotchas

- Seed rows (Goa, Hampi) are relative to `current_date` at seed time and only appear after `db:reset`.
- Haptics fire on native only.
- Only the month on screen and its neighbours are rendered, so `find` a day in another month only after moving to it.
- The `Places` / `Dates` and `My days` / `Everyone` controls are both tab lists; `find` the exact label.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
