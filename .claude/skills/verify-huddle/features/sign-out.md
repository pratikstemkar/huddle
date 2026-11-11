# Sign out

Tapping your avatar initial on home signs you out and returns you to sign-in.

## Sub-features

- Clears the Supabase session from `localStorage` (web) / AsyncStorage (native).
- Route guard sends you back to `/sign-in`.

## How to get to it (user POV)

Home (`/`) → the round avatar with your initial, top right.

## Driving it with the built-in browser

1. Signed in on `/`: `find "Sign out"` → click → wait 1s.
2. URL becomes `/sign-in`, `find "Sign in as"` returns 4 buttons.
3. `navigate` to `http://localhost:8091/` → still lands on `/sign-in` (session really gone, not just a redirect).

## Gotchas

- There's no confirmation dialog; one tap signs out.
- The control is labelled `Sign out` but visually shows only the initial.
