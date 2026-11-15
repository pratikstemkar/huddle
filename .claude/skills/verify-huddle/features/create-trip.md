# Create trip

`/new-trip` (a full-screen modal; a normal page on web), opened by the Pip button in the home tab bar (`Pip: start a new trip`) or `Start a trip` on Pip's hero card. Two steps:

1. **Step 1 of 2:** "Start a new trip", `Trip name` (label "What should we call it?", max 60), a colour (`Iris` default, `Beak yellow`, `Mint`, `Blush`, `Coral`), and Dates: `Let the group vote` (default) or `I already know` with a date range picker ([fixed-dates](fixed-dates.md)). `Next: invite people` creates the trip.
2. **Step 2 of 2:** the invite panel for the new trip ([invite-share](invite-share.md)) and `Go to the trip`, which replaces the modal with `/trip/<id>`. `Back` returns to step 1; pressing `Next: invite people` again updates the same trip instead of creating a second one.

The creator becomes organiser (`on_trip_created` trigger).

## Sub-features

- Empty or whitespace-only name → "Give your trip a name first." and nothing is created.
- `I already know` with no day tapped → "Pick the first and last day of the trip."
- Submit with `Next: invite people` or the keyboard return key in `Trip name`.
- Failure → "Couldn't create the trip. Check your connection and try again." ("Couldn't save the trip…" when updating from a second pass).
- `Close` (step 1) goes back, or to `/` when there's no history.

## Driving it with the built-in browser

1. `db.mjs trips aarav@dev.test --out <run>/before.json`
2. On `/sign-in`: `Sign in as Aarav` → URL `/`.
3. `find "Pip: start a new trip"` → click → URL `/new-trip`, text has `Step 1 of 2`.
4. Click `Next: invite people` with the name empty → the name error, URL stays `/new-trip`.
5. `find "Trip name"` → click the `textbox` → `type` `<PREFIX><label>` (e.g. `verify-cd9004-mint`) → click the `Mint` radio.
6. `Next: invite people` → wait 2s → text has `Step 2 of 2`, `Get the gang in`, `Anyone with the code can join <PREFIX><label>.`, `In the huddle · 1`.
7. `Go to the trip` → URL `/trip/<id>`. `Back to your trips` → `/` lists the new trip. Screenshot.
8. `db.mjs trips aarav@dev.test --out <run>/after.json`: the new row has `color: "mint"`, `status: "planning"`, an 8-char `invite_code`, and `trip_members` = Aarav as `organiser`.
9. RLS: `db.mjs trips kabir@dev.test` must **not** include it.
10. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- `db.mjs` doesn't return `fixed_start` / `fixed_end`; read them with psql for a fixed-dates trip.
- Older apps still send the old colour keys (`sunset`, `lagoon`, …); a trigger maps them to the new five (`…_huddle_colours.sql`).
- On web there's no haptic; success haptics are native-only and unverified here.
- The text field uses `accessibilityLabel`, so the `find` hit you want is `textbox`, not the label text above it. Same for buttons: pick the `button` match.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
