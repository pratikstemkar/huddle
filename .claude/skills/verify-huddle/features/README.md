# Huddle feature map

Every user-facing feature, how to reach it on web, and what proves it works. Keep this in step with `src/app/` — `/pstack:maintain-verification-skill` checks for drift.

| Feature | Route(s) | File | Last proven |
|---|---|---|---|
| Dev sign-in | `/sign-in` | [sign-in.md](sign-in.md) | 2026-11-11 (as Aarav) |
| Trips list (home) | `/` | [trips-list.md](trips-list.md) | 2026-11-11 |
| Create trip | `/` → `/new-trip` | [create-trip.md](create-trip.md) | 2026-11-11 (full journey + DB + RLS) |
| Sign out | `/` | [sign-out.md](sign-out.md) | 2026-11-11 |

## In the schema, not in the UI yet

These exist in `supabase/migrations/` but no screen reaches them. Add a feature file when a route ships:

- Join a trip by invite code (`join_trip(code)` RPC).
- Availability, destinations, votes, and locking a trip (tables + RLS + realtime).
- Opening a trip card (the card is a button with no `onPress` yet).
