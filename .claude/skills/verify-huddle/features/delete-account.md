# Delete my account

`/profile` → `Delete account` → `/delete-account`. The screen lists what happens to each of my trips (from `account_deletion_preview()`), then `Type DELETE to confirm` + `Delete my account` (or `Keep my account`). On success the app signs out locally and lands on `/sign-in`.

## What the database does (`…_delete_account.sql`)

- `delete_my_account()` deletes only the caller (no user id argument); `anon` can't execute it.
- A trip where I'm the last organiser and others remain → the longest-standing member becomes organiser.
- A trip where I'm the only member → deleted.
- Otherwise I just leave. Trips I created and places I suggested stay with `created_by = null` (shown as "Suggested by Someone"). My days, votes, memberships, profile and auth user go.

## Driving it

**This deletes a user. Never run it against the shared local Supabase.** Start this checkout's own stack (AGENTS.md → "Local testing alongside other checkouts"), point `.env.local` at it, then:

1. `db.mjs trips meera@dev.test --out <run>/before-meera.json`.
2. Sign in as Aarav → `Your profile` → `Delete account`. Expect "Goa in March passes to Meera as organiser." and the same for "Pondy long weekend".
3. Press `Delete my account` with the box empty → "Type DELETE to confirm." and nothing deleted.
4. Type `DELETE` → `Delete my account` → URL `/sign-in`.
5. `db.mjs trips meera@dev.test` → both trips, Meera `organiser`, `created_by: null`. `db.mjs trips aarav@dev.test` → "Invalid login credentials".
6. Sign in as Meera → `/trip/<goa>/places` → Aarav's places say "Suggested by Someone", and Meera has `Remove` on every place.
7. Restore: `bunx supabase db reset --workdir <your stack>` (your own stack only), then point `.env.local` back.

## Gotchas

- The sign-out after deletion logs a 403 from `/auth/v1/logout?scope=local`: the server session died with the user. supabase-js still clears the local session; it's expected.
- Sign in with Apple token revocation isn't done yet (needs a development build and an Apple key).

Last proven: 2026-11-14 (Aarav deleted on an isolated stack; DB + Meera's view).
