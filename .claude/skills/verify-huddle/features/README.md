# Huddle feature map

Every user-facing feature, how to reach it on web, and what proves it works. Keep this in step with `src/app/` — `/pstack:maintain-verification-skill` checks for drift.

| Feature | Route(s) | File | Last proven |
|---|---|---|---|
| Dev sign-in | `/sign-in` | [sign-in.md](sign-in.md) | 2026-11-11 (as Aarav) |
| Trips list (home) | `/` | [trips-list.md](trips-list.md) | 2026-11-11 |
| Create trip | `/` → `/new-trip` | [create-trip.md](create-trip.md) | 2026-11-11 (full journey + DB + RLS) |
| Sign out | `/` | [sign-out.md](sign-out.md) | 2026-11-11 |
| Trip detail | `/` → `/trip/[id]` | [trip-detail.md](trip-detail.md) | 2026-11-11 (Aarav, Meera, Kabir RLS) |
| Share invite code / link | `/trip/[id]` | [invite-share.md](invite-share.md) | 2026-11-11 (Aarav) |
| Join a trip by code | `/` → `/join` | [join-trip.md](join-trip.md) | 2026-11-11 (Kabir, DB + RLS) |

## In the schema, not in the UI yet

These exist in `supabase/migrations/` but no screen reaches them. Add a feature file when a route ships:

- Availability, destinations, votes, and locking a trip (tables + RLS + realtime).
