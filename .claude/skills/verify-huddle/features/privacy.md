# Privacy policy

Public page at `/privacy`, readable signed in or out. The text lives in `src/lib/privacy.ts` (`PRIVACY_SECTIONS`, `PRIVACY_UPDATED`, `PRIVACY_CONTROLLER`, `PRIVACY_CONTACT`).

Entry points: `Privacy policy` on `/sign-in` (bottom of the footer) and on `/profile`. `Done` goes back, or home when opened directly.

## Driving it

1. Signed out, open `/` → must land on `/sign-in`, **not** `/privacy` (see gotcha).
2. `Privacy policy` → URL `/privacy`, page shows "Last updated …" and every section heading. `Done` → `/sign-in`.
3. Signed in, `Your profile` → `Privacy policy` → `/privacy`.

## Gotchas

- The root layout gives each `Stack.Protected` an explicit `redirectTo`. Without it, Expo Router sends a signed-out `/` to the "first available screen", which picked the public `privacy` route over `sign-in`.

Last proven: 2026-11-14 (signed out from sign-in, redirect check).
