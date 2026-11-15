# Vote on destinations

Vote tab → `Places` segment (the default; `/trip/<id>/vote?seg=places`; the old `/trip/<id>/places` redirects here). Header: `<trip> · <k> of <n> voted` and "Where should we go?". Places are ranked by votes, oldest first among ties.

Each card: a thumbnail (if it has a photo), the title, a `Leading` badge on the top place(s) once anyone has voted, "Suggested by <name>" (`you`, or `Someone` for a deleted account) and the note, a progress bar (`<votes> of <members> voted for <title>`), and the vote button: `Vote for <title>` / `Remove your vote for <title>` with the count. Tapping the card body (`<title>, N votes`) opens the details: the photo, the link (`Open link, <domain>`), "Voted by <names>" or "No votes yet", and `Remove <title>` for its author and the organiser. You can vote for any number of places, once each.

Below the list: `Suggest a place` ([suggest-destination](suggest-destination.md)) and Pip: "Back as many places as you like." + "Everyone has voted." / "<name> is the only one left to vote." / "You're the only one left to vote." / "<k> still to vote." Locked: "Voting's closed. <place> won.", the vote buttons are disabled and there is no `Suggest a place` or `Remove`. No places: "No places yet" and "Suggest somewhere to go, then everyone can vote."

The Trip tab's Vote tile shows `<leader> leads, <k> of <n> voted`; Pip's `Vote` and the home hero's `Vote` open this segment.

## Driving it

1. Seeded Goa as Aarav → `Vote` tab: Palolem Beach (2, `Leading`), Old Goa and Fontainhas (1), Anjuna flea market (0); kicker `Goa in March · 2 of 2 voted`.
2. Use a `PREFIX` trip for writes: create one, `Suggest a place`, then click `Vote for <title>` → the count becomes 1, `Leading` shows, and the button is now `Remove your vote for <title>`. Open the card → `Voted by you`.
3. DB: `votes` has `(destination_id, user_id)`.
4. Click `Remove your vote for <title>` → count 0, the row is gone.
5. `Remove <title>` → the browser confirm `Remove "<title>"? Its votes go too.` → accept → the card is gone.
6. RLS: a non-member reads no `votes` / `destinations` for the trip.
7. Cleanup: `db.mjs cleanup <email> "$PREFIX"`.

## Gotchas

- On web `Remove` uses `window.confirm`; the browser pane may need the dialog accepted (or patch `window.confirm = () => true` first).
- Other people's votes show live ([live-updates](live-updates.md)).

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
