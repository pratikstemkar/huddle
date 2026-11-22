# First-open intro with Pip

Six pages Pip walks a newcomer through before sign-in: hello, decide together (dates and places), plan the days and hangouts, split costs, the shared album, and "Ready". `/intro` is one route; the pages sit side by side in a paged horizontal scroll, so Next, Back and a sideways swipe all slide.

## Sub-features

- Shown only when signed out and `localStorage['huddle.introSeen']` isn't `'1'`. Signed-out `/` (or any `(app)` link) redirects to `/intro` the first time, `/sign-in` after.
- Any sign-in on the device sets the flag, so someone who signs out later goes straight to sign-in.
- An invite link (`/invite/[code]`, `/group-invite/[code]`) sets the flag too: those people go invite → sign in → join, no intro.
- Skip (every page but the last), `I already have an account` (page 1) and `Get started` (page 6) → `/sign-in` and set the flag.
- `I have an invite code` (page 6) also sets `huddle.joinAfterSignIn`; after sign-in `(app)` opens `/join` with an empty code box once.
- Page dots grow into a pill following the scroll; Pip plays a mood when its page arrives (`hello`, `hmm`, idle, shades, wave, `yay`); the "Pip says" bubble pops in. Reduced motion: no slide or pop.
- Only the page on screen is exposed to screen readers (`aria-hidden` on the others). Note `find` ignores `aria-hidden`, so it returns the Next buttons of every page; check `[data-testid=intro-page-N]` instead.
- Native only (not covered here): haptic tick on each page change, Android back button stepping back a page.

- Notifications page ("Know the moment the plan moves", between Photos and Ready): only on a real phone whose push permission is undetermined and `huddle.pushAsked` isn't set, so **web never shows it** and the intro stays six pages there. `Turn on notifications` shows the system prompt and sets `huddle.pushAsked`; `Not now` doesn't (a trip can ask again). Skip from an earlier page lands on it, and either button then goes straight to sign in. Covered by `__tests__/app/intro-test.tsx`; check the system prompt on a device.

## How to get to it (user POV)

Fresh install (or cleared site data), signed out → open the app.

## Driving it with the built-in browser

1. Signed in? Sign out first (`sign-out.md`). Then `javascript_tool`: `localStorage.removeItem('huddle.introSeen')` and `location.href = 'http://localhost:<PORT>/'`; wait 3s → URL `/intro`, text has `Trips with your people, minus the group-chat chaos`.
2. Arm a scroll recorder on `[data-testid=intro-pager]` (push `scrollLeft` on each `scroll` event), `find "Show me around"` → click → wait 1.5s. Several increasing `scrollLeft` values ending at the page width prove it slid rather than jumped. Text has `Pick when and where, together`.
3. `Next` → `Plan every day…` → `Split costs…` → `Every photo…` → `Ready when your people are`. Each step: only `intro-page-<current>` lacks `aria-hidden="true"`.
4. Swipe: back on page 1, `computer scroll right` over the page → `scrollLeft` snaps to exactly one page width.
5. `I have an invite code` → URL `/sign-in`, `localStorage` has `huddle.introSeen = '1'` and `huddle.joinAfterSignIn = '1'`. `Sign in as Aarav` → URL `/join`, `huddle.joinAfterSignIn` is gone.
6. Sign out → lands on `/sign-in`, not `/intro`.

No DB rows change; evidence is the URLs, `localStorage` values and screenshots.

Last proven: 2026-11-22 (web, light and dark).
