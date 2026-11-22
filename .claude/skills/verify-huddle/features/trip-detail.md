# Trip detail (Trip tab)

Tapping a trip card opens `/trip/<id>`, the Trip tab. The trip has its own tab bar: `Trip`, `Vote`, `Plan`, `Split`, `Photos` and `Ask Pip`.

From the top:

- **Header:** `Back to your trips`, the members' faces (`<n> people in the huddle`) and a + (`Invite people`); both open the invite sheet ([invite-share](invite-share.md)).
- **Hero:** the trip name over a big line. With dates (locked, else fixed): a countdown (`<n> days to go`, `Tomorrow!`, `Today's the day`, `Day 2 of 4`, `That's a wrap`) and `<range> · <n> people` on beak yellow. Without dates: the best range so far and `Best days so far · <k> of <n> marked`, or `When can you go?` and "Nobody has marked their days yet" / "<k> of <n> have marked their free days"; this hero is a button to Vote → Dates.
- **Locked summary** for a locked trip ([locked-summary](locked-summary.md)).
- **Tiles** (each a button to its tab): `Vote` (`<leader> leads, <k> of <n> voted`, `Nobody has voted yet`, `No places yet`, or `<place> won` once locked), `Plan` (`<k> of <n> days planned` or `Opens once dates are locked`), `Split` (`You're owed ₹…`, `You owe ₹…`, `You're all square`, `Nothing spent yet`), `Photos` (`<n> so far` or `None yet`).
- **Pip says** (`pipNext` in `src/lib/trip-status.ts`): one line and one button, which `Ask Pip` in the tab bar also runs. Planning, first match: organiser with a place and dates → `Lock` (`Lock in the plan`); I haven't marked days (vote-dates trips) → `Mark days`; no places → `Suggest`; I haven't voted → `Vote`; only me → `Invite`; fixed dates → the Plan / Split nudge; someone still to vote → `Nudge` ([nudge](nudge.md)); else `See votes`. Locked: an empty plan day → `Plan`, I owe someone → `Split`, trip over and no photos from me → `Photos`, else "It's official. Tell the group chat." + `Share`.
- **`Trip settings`** row: "Rename, privacy, people" for organisers, "Leave trip" for members ([trip-settings](trip-settings.md), [leave-trip](leave-trip.md)).

## Sub-features

- **Not found:** a missing id, a malformed id, or a trip you're not a member of (RLS returns no row) → "Trip not found", "This trip doesn't exist, or you're not a member of it." and `Back to your trips` (header and footer).
- **Load error:** "Something went wrong", the error, and `Try again`.
- Refetches on focus and live ([live-updates](live-updates.md)); if the trip disappears while open (deleted), it goes to `/`.
- A locked trip seen for the first time on this device opens the celebration screen ([locked-celebration](locked-celebration.md)).

## Driving it with the built-in browser

1. Sign in as Aarav → click `Goa in March, Voting open` → URL `/trip/aaaaaaaa-0000-0000-0000-000000000001`.
2. `get_page_text`: `Best days so far · 2 of 2 marked`; tiles `Palolem Beach leads, 2 of 2 voted`, `Opens once dates are locked`, `Nothing spent yet`, `None yet`; Pip "Looks like Palolem Beach on <range>. Ready to lock it in?". `find "Lock in the plan"` → the Pip button. `find "2 people in the huddle"` → one button.
3. Click `Back to your trips` → URL `/`.
4. Navigate to `/trip/00000000-0000-0000-0000-00000000dead` and `/trip/not-a-uuid` → both show `Trip not found` (no 400s in the network log for the malformed one).
5. Sign in as Meera → Goa → Pip says "Everyone's voted. Waiting on the organiser to lock it in." with `See votes`; the settings row reads `Leave trip`.
6. Sign in as Kabir → navigate to the Goa URL → `Trip not found` (RLS).
7. Cross-check member count and roles with `db.mjs trips <email>`.

## Gotchas

- Pip's line depends on the whole trip (who marked, voted, organiser); a changed seed or leftover test rows change it.
- The hero animates in; screenshot after ~2s.
- Typed routes: if `tsc` rejects a trip route, start Expo once so `.expo/types` regenerates.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
