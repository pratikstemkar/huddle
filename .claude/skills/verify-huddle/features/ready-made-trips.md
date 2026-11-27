# Ready-made trips (Explore)

For people who'd rather pick a plan than decide where to go: browse destinations, open one, pick a day-by-day plan, choose the first day, invite people. The trip that comes out is an ordinary trip with fixed dates, the destination as its one place, and the plan copied onto its days. Everything after that is the usual Plan tab and settings.

## Ways in

- **Home (Trips tab):** "Ideas for your next trip" row under your trips: compact cards (`<name>, <country>, N plans · <length>`) and `See all` → `/explore`.
- **New trip step 1:** `Not sure where? Browse ready-made trips` card → replaces the modal with `/explore` (keeps `?group=`).
- **Group:** `Start a trip` from a group → new trip → the same card; the group id rides along to the end.

## Screens

- `/explore`: `Back`, filter chips `All` / `India` / `Abroad` / `Beaches` / `Mountains`, a two-column grid of destination cards `<name>, <country>, N plans · <a>–<b> nights`.
- `/explore/[destination]`: cover photo, name, country, blurb, `Photo: <name> on Unsplash`, then "Pick a plan" cards `<title>, N nights, N+1 days, <pace>` with up to three highlights.
- `/explore/plan/[id]`: destination line, title, summary, length and pace badges, then `Day 1`, `Day 2` … with each item as `<time>, <title>[, <note>]`; footer `Use this plan` → `/new-trip?template=<id>`.
- `/new-trip?template=<id>` step 1: the plan card with `Change plan` (back to the plan), `Trip name` prefilled as `<destination> trip`, colours, and "When do you start?" with the date picker in fixed-length mode: one tap picks the whole range (`Tap the first day of the trip`). No vote/fixed choice. `Next: invite people` with no day says "Pick the first day of the trip."
- Step 2 is the usual invite panel. `Go to the trip` clears the Explore screens (`dismissTo('/')`) and opens the trip.
- **Settings → Dates** on any trip with fixed dates: changing the first day shows a `Move the plan too` switch (on by default) and "Every plan moves N days later/earlier…". Off: "Plans stay on their dates…".

## What the database does (`…_trip_templates.sql`)

- `catalog_destinations`, `catalog_itineraries`, `catalog_itinerary_items`: read-only, `select` for signed-in users only (published rows); anon has no access, nobody writes from the app. 10 destinations, 20 plans in the migration. Covers are Unsplash links (hotlinked, with `photo_credit`).
- `create_trip_from_template(itinerary, trip_name, trip_color, start_day, trip_group)`: inserts the trip (`fixed_start = start_day`, `fixed_end = start_day + nights`, `template_id`), the caller becomes organiser via the usual trigger, adds one `destinations` row (the cover as `image_url`), copies every item into `itinerary_items` with `created_by` = caller. Unpublished or unknown plan → "That plan is no longer available". The group check (`check_trip_group`) still applies.
- `shift_plan(t, days)`: organisers only; moves every `itinerary_items.day` on the trip.
- `trips.template_id` references `catalog_itineraries` (`on delete set null`).

## Driving it

Needs an isolated Supabase while the migration isn't on `main` (AGENTS.md).

1. Sign in as Aarav → Trips tab → scroll to "Ideas for your next trip" → `See all`.
2. `/explore`: ten cards; `Abroad` leaves five. `Goa, India, 2 plans · 3–4 nights` → `/explore/goa`.
3. `North Goa: beaches and nights out, 4 nights, 5 days, Balanced` → `Day 1` … `Day 5` → `Use this plan`.
4. New trip: name reads `Goa trip`; rename to `<PREFIX>goa`; `Next month` → tap the 10th → the range covers the 10th–14th → `Next: invite people` → `Go to the trip`.
5. Trip tab: `Dec 10–14 · Just you`, Plan tile `5 of 5 days planned`; Plan tab shows the copied items, `Added by you`, editable.
6. Edit one item's title on the Plan tab → saves.
7. `Trip settings` → Dates → tap a new first and last day a week later → `Move the plan too` is on, caption says "7 days later" → `Save dates` → Plan tab shows the new days with every item on them.
8. DB (psql, read-only): the trip has `template_id = goa-north`, `fixed_*` = the new range, 1 destination, 14 items spanning the new range; the edited title kept.
9. RLS: `db.mjs trips meera@dev.test` doesn't list it.
10. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

Last proven: 2026-11-27 (web, isolated Supabase): steps 1–10. Not covered: native (the new-trip modal → Explore → modal stack on iOS/Android, haptics), and `Back` from the trip after `Go to the trip`.
