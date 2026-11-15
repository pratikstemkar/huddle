# Dev sign-in

Developer sign-in lets you be any of four seeded people (Aarav, Meera, Kabir, Zoya) without Google or Apple, so one device can play a whole group.

## Sub-features

- The welcome scene: Pip, the Huddle wordmark and "Plan trips with your people…", then `Continue with Google` (and Apple's button on iOS).
- Four chips under "Developer sign-in (local Supabase only)", shown only when `__DEV__` and `EXPO_PUBLIC_DEV_AUTH=true`.
- Signs in with email + `EXPO_PUBLIC_DEV_PASSWORD` against local Supabase; an error shows under the Google button.
- "Supabase isn’t set up yet" card when the URL or anon key is missing.
- The footer sentence "By continuing you agree to the privacy policy." links to `/privacy` ([privacy](privacy.md)).
- Route guard: signed-out users only reach `/sign-in` (plus `/invite/<code>` and `/privacy`); signed-in users are redirected to `/`.
- Google (real OAuth) and Apple (iOS only) are out of scope for this skill.

## Driving it with the built-in browser

1. `navigate` to `http://localhost:<PORT>/` → URL becomes `/sign-in`.
2. `find "Sign in as"` → exactly 4 buttons.
3. Click `Sign in as Meera` → wait 2s → URL `/`, `get_page_text` contains `Hey Meera`, `Where to next?` and `Goa in March` (she's a seeded member).
4. Proof of the guard: `navigate` to `/sign-in` while signed in → you end on `/`.

## Gotchas

- Chips missing = `.env.local` lacks `EXPO_PUBLIC_DEV_AUTH=true`, or Expo wasn't restarted after editing it.
- "Invalid login credentials" = seed not loaded (`auth.users` has no `@dev.test` rows) — doctor catches this; reseeding needs `bun run db:reset` (ask first).
- Session lives in `localStorage` per origin, so each slot port and the user's 8081 are independent.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11, as Aarav).
