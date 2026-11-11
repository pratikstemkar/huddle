# Join a trip by invite code

Home has a secondary `Join with a code` button under `New trip`. It opens `/join` (form sheet): a code field and `Join trip`. On success it replaces the sheet with `/trip/<id>`; Back returns to home. `/join?code=<code>` pre-fills the field but does not join until `Join trip` is pressed.

## Sub-features

- Code is trimmed; the server lowercases it (`join_trip`). ` GOA2027 ` works.
- Empty → "Enter the invite code your friend sent you."
- Unknown code → "That code doesn't match a trip. Check it and try again." (the RPC returns a 400; that is expected, not a bug).
- Already a member → opens the trip, no duplicate `trip_members` row (`on conflict do nothing`).
- Other failures → "Couldn't join the trip. Check your connection and try again."

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Join with a code` (home) | button |
| `Invite code` | textbox |
| `Join trip` | button |

1. Sign in as Kabir (in no Goa membership) → `Join with a code` → URL `/join`.
2. Click `Join trip` empty → empty-code message. Type `nope1234` → unknown-code message.
3. Triple-click the field, type ` GOA2027 `, click `Join trip` → URL `/trip/aaaaaaaa-…0001`, `Who's going · 3`, `Kabir (you)`.
4. Navigate to `/join?code=goa2027` → the textbox value is `goa2027`; `Join trip` again → trip opens, still 3 members, no error toast.
5. Navigate back from the trip → `/`.
6. Check `db.mjs trips kabir@dev.test` / `aarav@dev.test` / `meera@dev.test` — all list Goa with the same 3 members.

## Cleanup

This writes a `trip_members` row on the **seed** trip, which the prefix cleanup doesn't touch. Remove Kabir's row as Kabir (the leave-trip delete policy allows it) so the seed stays "Kabir and Zoya are in no trips": sign in as `kabir@dev.test` with supabase-js and `delete().eq('trip_id', 'aaaaaaaa-0000-0000-0000-000000000001').eq('user_id', <kabir id>)`.

## Gotchas

- Opening `/join` directly (no history) used to throw "POP … not handled" with `router.dismiss()`; the screen uses `router.replace` for that reason.
- A signed-out visit to `/join?code=…` is redirected to `/sign-in` and the code is lost (post-MVP deep-link item).

Last proven: 2026-11-11 (Kabir join, Aarav + Meera see 3 members).
