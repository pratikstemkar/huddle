# Join a trip by invite code

The Invites tab (`/join`): "Got a code?", "Join a trip", Pip and "Paste the code or link your friend sent.", the `Invite code` field with a `Paste` chip (`Paste invite code`), and `Join trip`. Under it Pip says the code is on the trip screen, under the + next to everyone's faces. It's also reached from `Join with a code` on Pip's hero card when you have no trips.

On success it pushes `/trip/<id>` over the tabs, so Back returns to Invites. `/join?code=<code>` fills the field (also when the tab is already open) but doesn't join until `Join trip` is pressed.

## Sub-features

- The field takes a code or a whole invite link: `parseInviteCode` pulls the code out of `…/invite/<code>` (also `huddle://invite/<code>`), else trims the text. The server lowercases it (`join_trip`), so ` GOA2027 ` works.
- `Paste` reads the clipboard and runs the same parsing.
- Empty → "Enter the invite code your friend sent you."
- Unknown code → "That code doesn't match a trip. Check it and try again." (the RPC returns a 400; that's expected).
- Already a member → opens the trip, no duplicate `trip_members` row (`on conflict do nothing`).
- Other failures → "Couldn't join the trip. Check your connection and try again."
- After a join the field clears.

## Driving it with the built-in browser

1. Sign in as Kabir (not in Goa) → `Invites` tab → URL `/join`.
2. Click `Join trip` empty → the empty-code message. Type `nope1234` → `Join trip` → the unknown-code message.
3. Triple-click the field, type `http://localhost:<PORT>/invite/GOA2027` → `Join trip` → URL `/trip/aaaaaaaa-…0001`, `3 people in the huddle`.
4. Navigate to `/join?code=goa2027` → the textbox value is `goa2027`; `Join trip` again → the trip opens, still 3 members, no error.
5. Navigate back from the trip → `/join`.
6. Check `db.mjs trips kabir@dev.test` / `aarav@dev.test` / `meera@dev.test` — all list Goa with the same 3 members.

## Cleanup

This writes a `trip_members` row on the **seed** trip, which the prefix cleanup doesn't touch. Remove Kabir's row as Kabir (the leave-trip delete policy allows it) so the seed stays as described in SKILL.md: sign in as `kabir@dev.test` with supabase-js and `delete().eq('trip_id', 'aaaaaaaa-0000-0000-0000-000000000001').eq('user_id', '33333333-3333-3333-3333-333333333333')`. Or use `Trip settings` → `Leave trip` in the app.

## Gotchas

- `Paste` needs clipboard read permission, which the browser pane denies; type into the field instead.
- A signed-out visit to `/join?code=…` goes to `/sign-in` and loses the code. Shared links use `/invite/<code>`, which keeps it ([invite-link](invite-link.md)).

Last proven: not yet on the redesigned tab (last run on the old UI: 2026-11-11).
