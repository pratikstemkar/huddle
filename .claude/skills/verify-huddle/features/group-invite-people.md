# Invite a group to a trip

`/trip/<id>/invite-people` ("Who's invited?"), a sheet opened from `Invite from a group` in the invite sheet (`/trip/<id>/invite`; also step 2 of `/new-trip`, where it reads `Invite <group>` when the trip was started from a group). Organisers only (`invite_to_trip` refuses anyone else).

Group chips (one per group I'm in), "N of M from <group>" with `Select all` / `Clear`, a grid of the group's people (ticked = invited; people already in the trip show "In the trip", people already invited show "Invited"), Pip's note "Leaving N people out for this trip only. The group itself stays the same.", and `Invite N people`. Leaving people out affects this trip only; the group is unchanged.

Invitees see the trip under "Waiting on you" on their Groups tab ("Aarav invited you to Goa in March", "Trip · dates still open"), with the tab badge. `Join <trip>` (`accept_trip_invite`) adds them and opens the trip; the ✕ declines. Joining by the trip's code or link also clears the invite. The invite sheet lists "Invited · N" people who haven't answered.

## Driving it with the built-in browser

Needs an isolated stack (migration `…_trip_invites.sql`). Seed: Aarav organises **Goa in March** (Meera in it); Zoya already has a trip invite to it.

1. Sign in as Aarav → `/trip/aaaaaaaa-0000-0000-0000-000000000001/invite`: "Invited · 1" (Zoya), `Invite from a group`.
2. Open it: `College gang` chip, "1 of 1 from College gang", Meera "In the trip", Kabir ticked. `Invite 1 person` → back on the sheet, "Invited · 2".
3. Sign in as Zoya → `Groups` tab: both the College gang invite and "Aarav invited you to Goa in March", badge 2. `Join Goa in March` → `/trip/<id>`; `trip_members` has Zoya, `trip_invites` only Kabir.

## Cleanup

`db:reset` on the isolated stack restores the seed.

Last proven: not yet on a recorded run (driven once by hand during the build, 2026-11-19).
