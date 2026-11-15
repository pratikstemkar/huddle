# Share invite code / link

The invite sheet `/trip/<id>/invite` ("Invite"), opened from the trip header (`Invite people` or `<n> people in the huddle`), Pip's `Invite`, or step 2 of a new trip (same panel, `InvitePanel` in `src/components/invite-panel.tsx`):

- Pip, "Get the gang in", "Anyone with the code can join <trip>."
- The code as letter tiles, upper-cased (`Invite code g o a 2 0 2 7` to a screen reader).
- `Copy link`: copies `inviteLink(code)` (not the bare code); the label flips to `Copied` for ~1.8s.
- `Share`: the system share sheet with `Join "<trip name>" on Huddle! Use code <code>, or open <link>`. On web without the Web Share API it copies that message and flips to `Copied`.
- "In the huddle · N": each member with `(you)`, the `Organiser` badge, or `Just joined` (under 10 minutes, green) / `Joined today` / `Joined yesterday` / `Joined N days ago`. Live on `trip_members` and `trips`.
- `Done` / `Close` go back.

`inviteLink`: `<page origin>/invite/<code>` on web, `EXPO_PUBLIC_APP_URL/invite/<code>` in native builds (falls back to `huddle://invite/<code>` when unset). See [invite-link](invite-link.md).

## Driving it with the built-in browser

1. Sign in as Aarav → `Goa in March, Voting open` → `Invite people` → URL `/trip/aaaaaaaa-…0001/invite`; text has `In the huddle · 2`, `Aarav (you)`, `Organiser`, `Meera`.
2. Before clicking, patch `navigator.clipboard.writeText` via `javascript_tool` to push into `window.__w`.
3. `Copy link` → label `Copied`; `window.__w` ends with `http://localhost:<PORT>/invite/goa2027`.
4. `Share` (Chrome on Linux has no `navigator.share`) → `window.__w` ends with `Join "Goa in March" on Huddle! Use code goa2027, or open http://localhost:<PORT>/invite/goa2027`.

## Gotchas

- Reading the clipboard from the page is denied (`readText` permission); that's why the steps intercept the write.
- The native share sheet (`Share.share`) is not covered on web; needs a dev build.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-12).
