# Vote on destinations

`/trip/<id>/places` ("Where to?"), opened from `See all & vote` on trip detail. Places are ranked by votes, oldest first among ties. Each card shows image, note, link domain, `Suggested by`, `Voted by`, and a vote button: `Vote for <title>` / `Remove your vote for <title>` with the count (`♡ Vote · 0` ↔ `♥ Voted · 1`). You can vote for any number of places, once each. `Remove` shows for your own suggestions and for the organiser (confirms first). Locked trips are read-only.

Trip detail's **Where** card shows the top 3 with vote counts.

## Driving it

1. Trip with a suggestion → `See all & vote` → click `Vote for <title>` → text becomes `♥ Voted · 1`, `Voted by <you>`.
2. DB: `votes` has `(destination_id, user_id)`.
3. Click again → `♡ Vote · 0`; the row is gone.
4. RLS: a non-member reads no `votes`/`destinations`.

## Gotchas

- Other people's votes show live (see live-updates.md).
- Ranking order and the `Remove` rule for other people's suggestions need a second member; the seed adds 3 Goa places with votes after `db:reset`.

Last proven: 2026-11-11 (Zoya vote + unvote, DB, RLS as Meera). Not covered: Remove, multi-user ranking, native haptics/alert.
