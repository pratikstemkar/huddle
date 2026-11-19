# New group

`/new-group` (full-screen, from `New group` on the Groups tab): "Who's in this crew?", `Group name` (max 40), five colour radios, a `Search your people by name` box, picked people as removable chips, "From your trips and groups" (everyone you share a trip or group with, with where from), and `Create group · invite N`.

Only people you already share a trip or group with can be invited (`known_people()`; `invite_to_group` filters by `knows_person`). Anyone else joins from the group's join link. Creating a group makes me its admin and sends invites; picked people see them under "Waiting on you".

## Sub-features

- Empty name → "Give your group a name first."
- The search filters the list by name; `Add <name>` / `Remove <name>` toggles; the chip also removes.
- No known people yet → a note pointing at the join link.
- Success → `/group/<id>` (replaces the form).

## Driving it with the built-in browser

1. Sign in as Zoya → `Groups` → `New group`.
2. Click `Create group` empty → the name message. Type `Climbing crew`, pick `Mint`, `Add Aarav` → button reads `Create group · invite 1`.
3. Create → `/group/<id>`: "Climbing crew", "1 person", Zoya (you) Admin, Aarav `Invited`.
4. `group_invites` has Aarav → Zoya; sign in as Aarav and the Groups tab shows the invite.

## Cleanup

Delete the new group as its admin: leave it (the last member leaving removes it), or `db:reset` on the isolated stack.

Last proven: not yet on a recorded run (driven once by hand during the build, 2026-11-19).
