# Share invite code / link

On `/trip/<id>` the invite card shows the code with two buttons: `Copy code` (copies the code, caption flips to "Copied!" for ~2s) and `Share invite` (system share sheet with the message below).

Message: `Join "<trip name>" on Huddle! Use code <code>, or open <link>`. The link is `inviteLink(code)`: `<origin>/invite/<code>` on web, `EXPO_PUBLIC_APP_URL/invite/<code>` in native builds (falls back to `huddle://invite/<code>` when unset). See [invite-link](invite-link.md).

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Copy code` | button |
| `Share invite` | button |

1. Sign in as Aarav → open `Goa in March` → click `Copy code` → `get_page_text` shows `Copied!`.
2. Chrome on Linux has no `navigator.share`, so `Share invite` falls back to copying the whole message. Prove the text: before clicking, patch `navigator.clipboard.writeText` via `javascript_tool` to push into `window.__w`, then read `window.__w` → `Join "Goa in March" on Huddle! Use code goa2027, or open http://localhost:<PORT>/invite/goa2027`.

## Gotchas

- Reading the clipboard from the page is denied (`readText` permission); that's why step 2 intercepts the write.
- The native share sheet (`Share.share`) is not covered on web; needs a dev build.

Last proven: 2026-11-11 (Aarav, web).
