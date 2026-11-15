# Delete my account

You tab → `Delete account` → `/delete-account`. The screen lists what happens to each of my trips (from `account_deletion_preview()`), then `Type DELETE to confirm` + `Delete my account` (or `Keep my account`, or `Back`). On success the app signs out locally and lands on `/sign-in`.

## What happens (`…_delete_account.sql`, `src/lib/account.ts`)

- First the app removes the storage files of every album photo I uploaded, and all photos of trips that will be deleted (the database can't remove storage files).
- `delete_my_account()` deletes only the caller; `anon` can't execute it.
- A trip where I'm the last organiser and others remain → the longest-standing member becomes organiser (ties by user id).
- A trip where I'm the only member → deleted.
- Otherwise I just leave. Trips I created, places, plan items and expenses stay with my id set to null ("Someone"). Shares and settlements with me are nulled too, which writes off those debts pair by pair. My days, votes, album photos, memberships, profile and auth user go.

## Driving it

**This deletes a user. Never run it against the shared local Supabase.** Start this checkout's own stack (AGENTS.md → "Local testing alongside other checkouts"), point `.env.local` at it, then:

1. `db.mjs trips meera@dev.test --out <run>/before-meera.json`.
2. Sign in as Aarav → `You` → `Delete account`. Expect "Goa in March passes to Meera as organiser.", "Pondy long weekend passes to Meera as organiser." and "You’ll leave …" for Hampi surprise, Coorg weekend and Udaipur in winter.
3. Press `Delete my account` with the box empty → "Type DELETE to confirm." and nothing deleted.
4. Type `DELETE` → `Delete my account` → URL `/sign-in`.
5. `db.mjs trips meera@dev.test` → Goa and Pondy with Meera `organiser`, `created_by: null`. `db.mjs trips aarav@dev.test` → "Invalid login credentials".
6. Sign in as Meera → Goa → `Vote` tab → Places: Aarav's places say "Suggested by Someone". Pondy → `Split`: Aarav's Guesthouse shows "Someone paid", and the Pondy plan rows say "added by Someone".
7. Restore: `bunx supabase db reset --workdir <your stack>` (your own stack only), then point `.env.local` back.

## Gotchas

- The sign-out after deletion logs a 403 from `/auth/v1/logout?scope=local`: the server session died with the user. supabase-js still clears the local session; it's expected.
- The screen's explanation mentions days, votes, memberships and places, but not photos, plans or expenses.
- Sign in with Apple token revocation isn't done yet (needs a development build and an Apple key).

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-14, Aarav on an isolated stack; DB + Meera's view).
