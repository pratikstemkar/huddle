# Group details

`/group/<id>`: back button, `Edit` (admins), tile, name, "N trips together", `Start a trip`, a members card ("N people", `Add` for admins, one row each with Admin / Member, pending invites marked `Invited`), the **Join link** row with `Copy link` (→ "Copied"), and `Leave group`.

## Sub-features

- Admin menu (`Options for <name>`, never on my own row): `Make admin` / `Remove admin`, `Remove` (members only), `Cancel invite` for an invited person. Members see none of these.
- `Edit` → `/group/<id>/edit` sheet: name and colour. `Add` → `/group/<id>/add` sheet: the people picker; members and people already invited show "In the group" / "Invited" instead of a button.
- `Copy link` copies `<origin>/group-invite/<code>`. Opening that signed out shows the group ("College gang", "N people so far"), keeps the code, and after sign-in lands on `/join?code=` which joins it.
- Leave: `Leave group` → "Leave X? You can rejoin with the link." → `Leave X`. The last admin of a group that still has other people gets "Make someone else an admin first." The last person out deletes the group.
- Deleting my account hands each group I alone administer to its longest-standing member (or deletes it when empty).

## Driving it with the built-in browser

1. As Zoya (member of College gang): no `Edit`, `Add` or option buttons; `Copy link` and `Leave group` are there.
2. As Aarav (admin): `Options for Meera` → `Make admin Meera` → her row reads Admin (check `group_members.role`).
3. As Aarav with no other admin: `Leave group` → confirm → the "Make someone else an admin first." message, still on the page.

## Cleanup

`db:reset` on the isolated stack restores the seed.

Last proven: not yet on a recorded run (items 1 and 2 driven by hand during the build, 2026-11-19).
