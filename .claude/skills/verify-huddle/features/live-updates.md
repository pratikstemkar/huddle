# Live updates

`useTripLive` (`src/lib/realtime.ts`) reloads a screen about 250 ms after a change in the trip, after a dropped connection returns, and when a native app comes back to the foreground. Inserts are filtered by trip; deletes of `votes`, `destinations`, `itinerary_items`, `expenses`, `settlements` and `trip_photos` can't be, so a delete in any trip triggers a (harmless) reload.

| Screen | Tables it listens to |
|---|---|
| Trip tab, Vote tab (both segments), settings, lock sheet | all: availability, day_counts, destinations, votes, trip_members, trips, itinerary_items, expenses, settlements, trip_photos |
| Plan tab | itinerary_items, trips, trip_members |
| Split tab | expenses, settlements, trip_members |
| Photos tab, photo viewer | trip_photos, trip_members, trips |
| Invite panel (sheet and new-trip step 2) | trip_members, trips |
| Celebration screen | trips, trip_members, destinations |

## Driving it

One browser origin shares one session, so sign in as Aarav in the browser and act as Meera through the API (password sign-in at `/auth/v1/token`, then `POST`/`DELETE` on `/rest/v1/…` with her token, or `/rest/v1/rpc/save_expense`).

1. Use a `PREFIX` trip that Aarav organises and Meera has joined. Stay on the Trip tab.
2. Meera suggests a place → the Vote tile changes within ~2s, no reload. Meera votes → the tile reads `<place> leads, 1 of 2 voted`.
3. Meera marks days → the hero's `<k> of 2 marked` goes up.
4. Open the invite sheet, have Kabir join → he appears with `Just joined`.
5. On the Split tab, Meera adds an expense with `save_expense` → it appears in the feed and the balance card changes.
6. Meera deletes what she added → it disappears.
7. Delete every test row after (cleanup by `PREFIX`).

## Gotchas

- The shared local DB needs the redesign migrations for the new tables to be in the `supabase_realtime` publication; see SKILL.md.

Last proven: not yet on the redesigned screens (last run on the old UI: 2026-11-11, suggest, vote, days and deletes).
