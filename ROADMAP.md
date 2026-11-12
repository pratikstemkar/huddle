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
| 10 | See trip members | ✅ | ✅ `trip_members` | ✅ list on trip detail with avatars (photo or initial on their colour) | [trip-detail](.claude/skills/verify-huddle/features/trip-detail.md) |
| 11 | Mark the days I'm free | ✅ | ✅ `availability` | ✅ `(app)/trip/[id]/days` | [mark-days](.claude/skills/verify-huddle/features/mark-days.md) |
| 12 | See overlap: which days suit most people | ✅ | ✅ | ✅ Everyone tab + best days on trip detail | [overlap](.claude/skills/verify-huddle/features/overlap.md) |
| 13 | Suggest a destination (title, note, link, image) | ✅ | ✅ `destinations` + link/length checks | ✅ `(app)/trip/[id]/suggest` | [suggest-destination](.claude/skills/verify-huddle/features/suggest-destination.md) |
| 14 | Vote on destinations | ✅ | ✅ `votes` | ✅ `(app)/trip/[id]/places` + top 3 on trip detail | [vote](.claude/skills/verify-huddle/features/vote.md) |
| 15 | Live updates while others vote and mark days | ✅ | ✅ realtime on availability, destinations, votes, trips, trip_members | ✅ `useTripLive` on trip detail, days, places | [live-updates](.claude/skills/verify-huddle/features/live-updates.md) |
| 16 | Organiser locks the trip (dates + destination) | ✅ | ✅ `lock_trip()` + locked trips refuse new days, places and votes | ✅ `(app)/trip/[id]/lock` | [lock-trip](.claude/skills/verify-huddle/features/lock-trip.md) |
| 17 | Locked trip summary | ✅ | ✅ | ✅ summary on `(app)/trip/[id]`, dates on the trips list, share plan | [locked-summary](.claude/skills/verify-huddle/features/locked-summary.md) |
| 18 | Leave a trip | ✅ | ✅ delete policy + last-organiser guard, clears your days and votes | ✅ `Leave trip` in `(app)/trip/[id]/settings` | [leave-trip](.claude/skills/verify-huddle/features/leave-trip.md) |
| 19 | Organiser renames or deletes a trip | ✅ | ✅ | ✅ ⋯ button → `(app)/trip/[id]/settings` | [trip-settings](.claude/skills/verify-huddle/features/trip-settings.md) |

## Before launch

The planning loop above works end to end, but real friends can't use it yet. Work through these in order before handing Huddle to a real group. Hold off on bigger features (budgets, itinerary, chat, expenses) until this is done.

| # | Feature | Status | Why it matters | Notes |
|---|---|---|---|---|
| L1 | Production builds with EAS + a hosted web build | ⬜ | Nobody outside a dev machine can install or open the app, and invites only work if the friend can get it | iOS and Android store submission via `bunx eas-cli`; a hosted web build gives invite links somewhere to land |
| L2 | Invite links that work for new users | ⬜ | Invites are the whole growth loop | `inviteLink()` makes a `huddle://join?code=…` link a friend without the app can't open. Needs an https link (hosted web, universal/app links), and the code must survive sign-in: `/join?code=` pre-fills it today, but a signed-out visit loses it at sign-in |
| L3 | Google and Apple sign-in tested end to end | 🟡 | They are the only way real users can sign in; dev sign-in is dev-only | MVP rows 2 and 3: test Google against hosted Supabase, Apple in a development build |
| L4 | Push notifications | ⬜ | Without nudges people mark days once and drift off, and the organiser goes back to chasing them in the group chat | Start with "trip locked" and "vote now"; new votes later |
| L5 | Organiser can fix mistakes: unlock / re-plan, remove a member | ✅ | A wrong lock or an unwanted member today can only be fixed by deleting the trip | `unlock_trip()` + "organisers remove members" policy; both in `(app)/trip/[id]/settings`. Tested: [unlock-trip](.claude/skills/verify-huddle/features/unlock-trip.md), [remove-member](.claude/skills/verify-huddle/features/remove-member.md). A removed member can still rejoin with the code |
| L6 | Edit my profile (name, avatar) | ✅ | The display name comes from Google/Apple or the email prefix and can't be changed; also gives members avatars (MVP row 10) | `(app)/profile` (avatar on home): name + initials colour, sign out moved here; Apple's first-sign-in name now saved to the profile. Tested: [edit-profile](.claude/skills/verify-huddle/features/edit-profile.md) |

**Smaller checks before launch:** behaviour when the network drops or a request fails; an empty trips list that points new users to "join" vs "create"; an optional date range on a trip so people don't scroll through 4 months; a privacy policy, plus an account-deletion option (required by the app stores, and by Apple when Apple sign-in is offered).
