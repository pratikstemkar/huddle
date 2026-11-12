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
| Mark my free days | `/trip/[id]` → `/trip/[id]/days` | [mark-days.md](mark-days.md) | 2026-11-11 (Kabir, DB rows) |
| See overlap | `/trip/[id]/days` (Everyone), `/trip/[id]` | [overlap.md](overlap.md) | 2026-11-11 (Kabir + Zoya, RLS) |
| Suggest a destination | `/trip/[id]` → `/trip/[id]/suggest` | [suggest-destination.md](suggest-destination.md) | 2026-11-11 (Zoya, DB + RLS) |
| Vote on destinations | `/trip/[id]` → `/trip/[id]/places` | [vote.md](vote.md) | 2026-11-11 (Zoya, DB + RLS) |
| Live updates | `/trip/[id]`, `/days`, `/places` | [live-updates.md](live-updates.md) | 2026-11-11 (Aarav watching Meera) |
| Rename or delete a trip | `/trip/[id]` → `/trip/[id]/settings` | [trip-settings.md](trip-settings.md) | 2026-11-11 (Aarav, DB rows) |
| Leave a trip | `/trip/[id]` → `/trip/[id]/settings` | [leave-trip.md](leave-trip.md) | 2026-11-11 (Kabir, guard, DB rows) |
| Unlock a trip | `/trip/[id]` → `/trip/[id]/settings` | [unlock-trip.md](unlock-trip.md) | 2026-11-12 (Aarav, DB row) |
| Remove a member | `/trip/[id]` → `/trip/[id]/settings` | [remove-member.md](remove-member.md) | 2026-11-12 (Aarav removes Kabir, RLS) |
| Lock the trip | `/trip/[id]` → `/trip/[id]/lock` | [lock-trip.md](lock-trip.md) | 2026-11-11 (Aarav, RLS as Kabir) |
| Locked trip summary | `/`, `/trip/[id]` | [locked-summary.md](locked-summary.md) | 2026-11-11 (Aarav, seeded Pondy trip) |

