# Privacy policy

Public page at `/privacy`, readable signed in or out. The text lives in `src/lib/privacy.ts` (`PRIVACY_SECTIONS`, `PRIVACY_UPDATED`, `PRIVACY_CONTROLLER`, `PRIVACY_CONTACT`).

Entry points: the `privacy policy` link in the sign-in footer ("By continuing you agree to the privacy policy.") and the `Privacy policy` row on the You tab. `Back` (top) and `Done` (footer) go back, or home when opened directly.

## Driving it

1. Signed out, open `/` → must land on `/sign-in`, **not** `/privacy` (see gotcha).
2. `find "privacy policy"` → click the `link` → URL `/privacy`, page shows "Last updated …" and every section heading. `Done` → `/sign-in`.
3. Signed in, `You` tab → `Privacy policy` → `/privacy`.

## Gotchas

- The root layout gives each `Stack.Protected` an explicit `redirectTo`. Without it, Expo Router sends a signed-out `/` to the "first available screen", which picked the public `privacy` route over `sign-in`.
- `find "Privacy policy"` also matches the page heading; pick the `link` or `button` match.

Last proven: not yet on the redesigned screens (last run on the old UI: 2026-11-14, signed out, redirect check).
