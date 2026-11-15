# Sign out

You tab (`/profile`) → `Sign out` (the last row in the list under the profile card) returns you to sign-in.

## Sub-features

- Clears the Supabase session from `localStorage` (web) / AsyncStorage (native).
- Route guard sends you back to `/sign-in`.
- No confirmation; one tap signs out.

## How to get to it (user POV)

Any home tab → `You` in the tab bar (or the avatar on the Trips tab, `Your profile`) → `Sign out`.

## Driving it with the built-in browser

1. Signed in on `/`: `find "You"` → click the `tab` → URL `/profile`, text has `Signed in as <email>`.
2. `find "Sign out"` → click the `button` → wait 1s.
3. URL becomes `/sign-in`, `find "Sign in as"` returns 4 buttons.
4. `navigate` to `http://localhost:<PORT>/` → still lands on `/sign-in` (session really gone, not just a redirect).

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-12).
