# Huddle roadmap

What the MVP needs, and where each piece stands. Update the status when work lands.

**Status key:** ✅ Done · 🟡 Partly done · ⬜ To do

"Database" means the table, row-level security and functions are already in `supabase/migrations/`. "Tested" links to the matching feature file in the verify-huddle skill.

## MVP: plan a trip together

| # | Feature | Status | Database | App | Tested |
|---|---|---|---|---|---|
| 1 | Dev sign-in (seeded users) | ✅ | ✅ | ✅ `sign-in` | [sign-in](.claude/skills/verify-huddle/features/sign-in.md) |
| 2 | Google sign-in | 🟡 | ✅ | ✅ coded, not tested against hosted Supabase | |
| 3 | Apple sign-in (iPhone) | 🟡 | ✅ | ✅ coded, needs a development build to test | |
| 4 | Sign out | ✅ | | ✅ home | [sign-out](.claude/skills/verify-huddle/features/sign-out.md) |
| 5 | Trips list (home) | ✅ | ✅ | ✅ `(app)/index` | [trips-list](.claude/skills/verify-huddle/features/trips-list.md) |
| 6 | Create a trip (name + colour) | ✅ | ✅ | ✅ `(app)/new-trip` | [create-trip](.claude/skills/verify-huddle/features/create-trip.md) |
| 7 | Open a trip (trip detail screen) | ✅ | ✅ | ✅ `(app)/trip/[id]` | [trip-detail](.claude/skills/verify-huddle/features/trip-detail.md) |
| 8 | Share invite code / link | ✅ | ✅ `trips.invite_code` | ✅ copy + share on `(app)/trip/[id]` | [invite-share](.claude/skills/verify-huddle/features/invite-share.md) |
| 9 | Join a trip by invite code | ✅ | ✅ `join_trip(code)` | ✅ `(app)/join` | [join-trip](.claude/skills/verify-huddle/features/join-trip.md) |
| 10 | See trip members | 🟡 | ✅ `trip_members` | ✅ list on trip detail; no profile avatars yet | [trip-detail](.claude/skills/verify-huddle/features/trip-detail.md) |
| 11 | Mark the days I'm free | ✅ | ✅ `availability` | ✅ `(app)/trip/[id]/days` | [mark-days](.claude/skills/verify-huddle/features/mark-days.md) |
| 12 | See overlap: which days suit most people | ✅ | ✅ | ✅ Everyone tab + best days on trip detail | [overlap](.claude/skills/verify-huddle/features/overlap.md) |
| 13 | Suggest a destination (title, note, link, image) | ✅ | ✅ `destinations` + link/length checks | ✅ `(app)/trip/[id]/suggest` | [suggest-destination](.claude/skills/verify-huddle/features/suggest-destination.md) |
| 14 | Vote on destinations | ✅ | ✅ `votes` | ✅ `(app)/trip/[id]/places` + top 3 on trip detail | [vote](.claude/skills/verify-huddle/features/vote.md) |
| 15 | Live updates while others vote and mark days | ✅ | ✅ realtime on availability, destinations, votes, trips, trip_members | ✅ `useTripLive` on trip detail, days, places | [live-updates](.claude/skills/verify-huddle/features/live-updates.md) |
| 16 | Organiser locks the trip (dates + destination) | ✅ | ✅ `lock_trip()` + locked trips refuse new days, places and votes | ✅ `(app)/trip/[id]/lock` | [lock-trip](.claude/skills/verify-huddle/features/lock-trip.md) |
| 17 | Locked trip summary | ✅ | ✅ | ✅ summary on `(app)/trip/[id]`, dates on the trips list, share plan | [locked-summary](.claude/skills/verify-huddle/features/locked-summary.md) |
| 18 | Leave a trip | ✅ | ✅ delete policy + last-organiser guard, clears your days and votes | ✅ `Leave trip` in `(app)/trip/[id]/settings` | [leave-trip](.claude/skills/verify-huddle/features/leave-trip.md) |
| 19 | Organiser renames or deletes a trip | ✅ | ✅ | ✅ ⋯ button → `(app)/trip/[id]/settings` | [trip-settings](.claude/skills/verify-huddle/features/trip-settings.md) |

## After the MVP

Ideas to look at once the loop above works end to end. Nothing here is built.

| Feature | Notes |
|---|---|
| Edit my profile (name, avatar) | `profiles` update policy exists |
| Push notifications | New votes, trip locked |
| Deep link opens the join screen | `huddle://` scheme is set up for auth. `/join?code=` already pre-fills the code, but a signed-out visit loses it at sign-in |
| Unlock / re-plan a trip | |
| Remove a member (organiser) | Needs a new policy |
| Production builds with EAS | iOS and Android store submission |
