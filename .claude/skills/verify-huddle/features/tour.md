# Guided tour with Pip

After sign-in, Pip points at each control in turn: the screen dims with a cut-out around one target (beak-yellow ring) and a bubble says what it does, with step dots, `Skip tour` and `Next` (`Got it` on the last step). Tapping the dim also moves on. Code: `src/components/tour/`, flags in `src/lib/tour-seen.ts`.

## Sub-features

- **Home tour** (`/`, once the trips list has loaded): Trips tab, Groups tab, Pip button, Activity bell, You tab.
- **Trip tour** (first trip opened, once it has loaded): Trip tab, Vote, Lock (organisers only, on Pip's next-step card; skipped if that card isn't showing), Plan (members are told the organiser locks the dates), Split, Photos, the invite faces and `+`.
- A step whose target isn't on screen is skipped (the dots still count it).
- Each tour plays once per device: `localStorage['huddle.tour.home']` / `['huddle.tour.trip']` = `'1'` after `Got it` or `Skip tour`.
- `Show me around again` on the You tab clears both flags and goes to Trips, where the home tour plays; the trip tour plays on the next trip opened.
- The trip's push ask waits until the trip tour is done (native only).
- Native only (not covered here): Android back closes the tour, haptic tick on Next, screen reader announcement of each step.

## Driving it with the built-in browser

1. Signed in, `javascript_tool`: `localStorage.removeItem('huddle.tour.home'); localStorage.removeItem('huddle.tour.trip'); location.href = 'http://localhost:<PORT>/'`. Mobile viewport (`resize_window preset mobile`).
2. Wait 2s → `[data-testid=tour-overlay]` exists, text has `Your trips`. `find "Next"` → click; repeat through `Groups`, `Start a trip`, `Activity`, `You`, then `Got it` → overlay gone, `huddle.tour.home = '1'`.
3. Open a trip you organise with no locked dates (seeded `Goa in March` as Aarav) → `The trip at a glance`, `Vote first`, `Lock it in` (ring on Pip's card), `Then plan the days`, `Split the costs`, `Share photos`, `Bring the group` → `Got it` → `huddle.tour.trip = '1'`.
4. You tab → `Show me around again` → URL `/`, both flags gone, home tour shows. `Skip tour` → overlay gone, `huddle.tour.home = '1'`.

No DB rows change; evidence is the screenshots and `localStorage` values.

Last proven: 2026-11-27 (web, light and dark).
