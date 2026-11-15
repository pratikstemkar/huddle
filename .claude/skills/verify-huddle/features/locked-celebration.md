# Lock celebration

`/trip/<id>/locked`, a full-screen beak-yellow page with confetti: Pip (`Pip jumping for joy`), "It's official", "<place>, here we come!" (or "Here we come!"), a card with Where (or "To be decided") and When (the range), the faces and `<n> going · <countdown>`, then `Start planning the days` (goes to the Plan tab), `Add to calendar` ([add-to-calendar](add-to-calendar.md)) and `Close`.

When it shows:

- Straight after locking: the lock sheet is replaced by it ([lock-trip](lock-trip.md)).
- The first time this device opens a locked trip's Trip tab. It's remembered per trip in AsyncStorage (`localStorage` on web) as `huddle.lockedSeen.<trip id>`. Unlocking clears the key, so a re-lock celebrates again.
- Opened by URL on a trip that isn't locked: "This trip isn't locked in right now." and `Close`.

With reduced motion the confetti stays still and the card doesn't slide in.

## Driving it with the built-in browser

1. Sign in as Aarav. With `javascript_tool`: `localStorage.removeItem('huddle.lockedSeen.aaaaaaaa-0000-0000-0000-000000000002')`.
2. Open `Pondy long weekend` → URL `/trip/aaaaaaaa-…0002/locked`; text has `It's official`, `Pondicherry, here we come!`, `4 going · 40 days to go`.
3. `localStorage['huddle.lockedSeen.aaaaaaaa-0000-0000-0000-000000000002']` is `1`.
4. `Close` → the Trip tab. `Back to your trips`, open Pondy again → no celebration.
5. Remove the key again, open Pondy → on the celebration press `Start planning the days` → URL `/trip/aaaaaaaa-…0002/plan`.
6. Navigate to `/trip/aaaaaaaa-…0001/locked` (Goa, planning) → "This trip isn't locked in right now."

## Gotchas

- Seeded Coorg is locked too, so opening it the first time also shows this screen.
- Haptics on lock are native-only.

Last proven: not yet.
