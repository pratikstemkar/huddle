# Sign out

Home avatar (`Your profile`) → `/profile` → `Sign out` returns you to sign-in.

## Sub-features

- Clears the Supabase session from `localStorage` (web) / AsyncStorage (native).
- Route guard sends you back to `/sign-in`.

## How to get to it (user POV)

Home (`/`) → the round avatar top right → profile sheet → `Sign out` (below "Signed in as …").

## Driving it with the built-in browser

1. Signed in on `/`: `find "Your profile"` → click → URL `/profile`.
2. `find "Sign out"` (first match is the button) → click → wait 1s.
3. URL becomes `/sign-in`, `find "Sign in as"` returns 4 buttons.
4. `navigate` to `http://localhost:<PORT>/` → still lands on `/sign-in` (session really gone, not just a redirect).

## Gotchas

- There's no confirmation dialog; one tap signs out.
- Before L6 the avatar itself signed you out; it now opens the profile.

Last proven: 2026-11-12 (Aarav, from the profile sheet).
