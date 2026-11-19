# Groups tab

The Groups tab (`/groups`): "N invites · N groups" over "Your people", a `New group` button, then **Waiting on you** (one row per invite: "Aarav added you to College gang", `Decline <group>`, `Join <group>`), or Pip's "All caught up" note, then **Your groups**: a card per group with its tile, face stack, "N people · nothing planned yet / N trips together", a `Just joined` badge for a day after joining, and `Start a trip with <group>`. `Join with a code` (→ `/join`) sits under the list. With a pending invite the tab reads `Groups, N waiting` and shows a count badge.

Data: `group_summaries()`, `my_group_invites()`, `groups` + `group_members` (with profiles). Reloads on focus and live (`groups`, `group_members`, `group_invites` realtime).

## Sub-features

- Join: `Join <group>` calls `accept_group_invite`; the invite row disappears and the group card appears with `Just joined`; the tab badge clears.
- Decline: deletes my `group_invites` row.
- `Start a trip with <group>` → `/new-trip?group=<id>`; the trip is created with `group_id`, and the group's trip count goes up. (Phase 1 only links the trip; it doesn't invite the group's members yet.)
- Tapping a card opens `/group/<id>` ([group-details](group-details.md)).

## Driving it with the built-in browser

Needs an isolated stack (this feature ships a migration). Seed: **College gang** (Aarav admin, Meera and Kabir members), **Flatmates** (Meera admin, Aarav member), and a pending invite for Zoya to College gang.

1. Sign in as Zoya → the tab reads `Groups, 1 waiting`. Open it: "Aarav added you to College gang", "Group · 3 people".
2. `Join College gang` → the row goes, a `College gang` card with `Just joined` and "4 people · nothing planned yet" appears, the badge clears.
3. Check `group_members` has Zoya as `member` and `group_invites` is empty.

## Cleanup

Zoya's join changes the seed. `db:reset` on the isolated stack restores it.

Last proven: not yet on a recorded run (driven once by hand during the build, 2026-11-19).
