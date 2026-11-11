# Trip detail

Tapping a trip card opens `/trip/<id>`: a trip-coloured header (name, Planning / Locked in pill, back button), the invite code, a "When" card, a "Where" card, and "Who's going · N" with each member's initial, name, `(you)` and an `Organiser` tag.

## Sub-features

- **When:** planning → "Nobody has marked their days yet" or "N of M have marked their free days" (distinct users in `availability`), the best days so far, and a `Mark my days` button ([mark-days](mark-days.md), [overlap](overlap.md)). Locked → `locked_start – locked_end`.
- **Where:** planning → "No destinations yet", or each destination with its vote count. Locked → the locked destination's title and note.
- **Members:** organiser listed first, then by `joined_at`.
- **Not found:** a missing id, a malformed id, or a trip you're not a member of (RLS returns no row) → "Trip not found" + `Back to your trips`.
- **Load error:** "Couldn't load this trip…" + `Try again`.
- Refetches on focus.

## How to get to it (user POV)

Sign in → tap a trip card on home. Deep link `/trip/<uuid>` also works.

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `<trip name>, still planning` (home) | button — opens the trip |
| `Back to your trips` | button (header chevron, and the footer on not-found) |

1. Sign in as Aarav → click `Goa in March, still planning` → URL is `/trip/aaaaaaaa-0000-0000-0000-000000000001`; `get_page_text` has `goa2027`, `Who's going · 2`, `Aarav (you)`, `Organiser`, `Meera`.
2. Click `Back to your trips` → URL `/`.
3. Navigate to `/trip/00000000-0000-0000-0000-00000000dead` and `/trip/not-a-uuid` → both show `Trip not found` (no 400s in the network log for the malformed one).
4. Sign in as Meera → same trip shows `Meera (you)`, Aarav as `Organiser`.
5. Sign in as Kabir → navigate to the Goa URL → `Trip not found` (RLS).
6. Cross-check member count and roles with `db.mjs trips <email>`.

## Gotchas

- Seed has availability on the Goa trip (after `db:reset`) but no destinations, votes or locked trips, so those branches only show their empty states until those features land. Proving them needs rows written through their future UIs.
- The header animates in; screenshot after ~2s or it looks washed out.
- Typed routes: if `tsc` rejects `/trip/[id]`, start Expo once so `.expo/types` regenerates.

Last proven: 2026-11-11 (Aarav, Meera, Kabir; desktop dark + 375px light).
