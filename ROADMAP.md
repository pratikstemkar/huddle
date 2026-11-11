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
| 7 | Open a trip (trip detail screen) | ⬜ | ✅ | Card has no `onPress` yet | |
| 8 | Share invite code / link | ⬜ | ✅ `trips.invite_code` | | |
| 9 | Join a trip by invite code | ⬜ | ✅ `join_trip(code)` | | |
| 10 | See trip members | ⬜ | ✅ `trip_members` | | |
| 11 | Mark the days I'm free | ⬜ | ✅ `availability` | | |
| 12 | See overlap: which days suit most people | ⬜ | ✅ | | |
| 13 | Suggest a destination (title, note, link, image) | ⬜ | ✅ `destinations` | | |
| 14 | Vote on destinations | ⬜ | ✅ `votes` | | |
| 15 | Live updates while others vote and mark days | ⬜ | ✅ realtime on availability, destinations, votes, trips | | |
| 16 | Organiser locks the trip (dates + destination) | ⬜ | ✅ `trips.status`, `locked_*` | | |
| 17 | Locked trip summary | ⬜ | ✅ | | |
| 18 | Leave a trip | ⬜ | ✅ delete policy on `trip_members` | | |
| 19 | Organiser renames or deletes a trip | ⬜ | ✅ | | |

## After the MVP

Ideas to look at once the loop above works end to end. Nothing here is built.

| Feature | Notes |
|---|---|
| Edit my profile (name, avatar) | `profiles` update policy exists |
| Push notifications | New votes, trip locked |
| Deep link opens the join screen | `huddle://` scheme is set up for auth |
| Unlock / re-plan a trip | |
| Remove a member (organiser) | Needs a new policy |
| Production builds with EAS | iOS and Android store submission |
