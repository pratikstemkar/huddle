# Mark my free days

`/trip/<id>/days` (from the `Mark my days` button on trip detail) shows month calendars from today to 4 months ahead. In **My days** mode, tapping a day marks or clears it as free for you.

## Sub-features

- Tap saves at once (optimistic), then writes one `availability` row (insert on mark, delete on clear). A failed save rolls the day back and shows "Couldn't save that day…".
- Past days, and days beyond the 4-month window, are disabled (`not available` in their label).
- Locked trips are read-only: no toggle, calendar opens in Everyone mode.
- Refetches on focus.

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Mark my days` (trip detail) | button |
| `My days` / `Everyone` | tab |
| `<Weekday>, <Month> <day>` (e.g. `Saturday, November 21`) | button per day; gains `, you are free` once marked and `, N of M free` when anyone is |
| `Back to the trip` | button |

1. Create a `PREFIX` trip, open it, click `Mark my days`.
2. Click two days; `find` shows `you are free` on both. Click one again → label loses it.
3. Check rows: the day values match, and only your user id is on them (`availability` select as that user).
4. The previous screens stay mounted on web, so `find` the exact day label rather than scanning all buttons.

## Gotchas

- Seed rows (Goa trip) are relative to `current_date` and only appear after `db:reset`.
- Haptics fire on native only.

Last proven: 2026-11-11 (Kabir, Zoya; DB rows checked).
