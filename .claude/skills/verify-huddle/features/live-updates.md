# Live updates

Trip detail (`/trip/[id]`), `/trip/[id]/days` and `/trip/[id]/places` reload about 250 ms after anyone in the trip marks or clears a day, suggests or removes a place, votes, un-votes or joins (`useTripLive` in `src/lib/realtime.ts`). It also reloads after a dropped connection returns and when a native app comes back to the foreground.

## Driving it

One browser origin shares one session, so sign in as Aarav in the browser and act as Meera through the API (password sign-in at `/auth/v1/token`, then `POST`/`DELETE` on `/rest/v1/destinations|votes|availability` with her token).

1. Open "Goa in March" as Aarav, stay on trip detail.
2. Meera suggests a place → it appears under **Where** within ~2s, no reload.
3. Meera votes → count goes `0` → `1`. Meera marks days → `1 of 2 has marked their free days`.
4. Meera clears her days and removes the place → both disappear.
5. Prefix every test row with this checkout's `PREFIX` and delete it after.

## Gotchas

- The local DB needs `20261113000000_live_members.sql` applied (`bunx supabase migration up`) for live member joins.
- Deletes can't be filtered by trip, so votes/destinations deletes in other trips also cause a (harmless) reload.

Last proven: 2026-11-11 (suggest, vote, days, and deletes as Meera seen live by Aarav). Not covered: live member join, reconnect catch-up, native foreground reload.
