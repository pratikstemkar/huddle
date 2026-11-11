# Create trip

A signed-in user names a trip, picks one of six colours, and creates it. They become its organiser and it appears at the top of their home list.

## Sub-features

- Name validation: empty or whitespace-only name shows "Give your trip a name first." and creates nothing. Max 60 chars (input `maxLength`, DB check).
- Colour picker: six radios; the preview card and the `Create trip` button take the selected colour. Default `Sunset`.
- Submit by `Create trip` or the keyboard return key in `Trip name`.
- On success the sheet closes (`router.back()`) and home refetches on focus.
- Failure (network/RLS) shows "Couldn't create the trip. Check your connection and try again."

## How to get to it (user POV)

Sign in → home → tap `New trip` (bottom button). On web the native `formSheet` renders as a full route at `/new-trip`.

## Driving it with the built-in browser

1. `db.mjs trips aarav@dev.test --out <run>/before.json`
2. On `/sign-in`: `find "Sign in as Aarav"` → click. URL becomes `/`.
3. `find "New trip"` → click the `button` match. URL becomes `/new-trip`.
4. `find "Trip name"` → click the `textbox` match → `type` `verify-<label>`.
5. `find "Lagoon"` (or another colour) → click the `radio`.
6. `find "Create trip"` → click the `button` match → wait 2s.
7. Expect URL `/` and `get_page_text` listing `verify-<label>` first. Screenshot.
8. `db.mjs trips aarav@dev.test --out <run>/after.json`: the new row has `color` you picked, `status: "planning"`, an 8-char `invite_code`, and `trip_members` = Aarav as `organiser` (from the `on_trip_created` trigger).
9. RLS: `db.mjs trips kabir@dev.test` (or meera) must **not** include it.
10. Cleanup: `db.mjs cleanup aarav@dev.test verify-`.

Validation journey: step 3, then click `Create trip` with an empty name → `get_page_text` shows the error, URL stays `/new-trip`, and `after.json` has no new row.

## Gotchas

- On web there's no haptic; success haptics are native-only and unverified here.
- `formSheet` detents and grabber are native-only; web shows a normal page.
- The text field uses `accessibilityLabel`, so the `find` hit you want is `textbox`, not the `generic` label above it. Same for buttons: pick the `button` match.
