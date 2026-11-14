# Huddle roadmap

What the MVP needs, and where each piece stands. Update the status when work lands. Last checked against the code on 14 Nov 2026.

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
| 11 | Mark the days I'm free | ✅ | ✅ `availability` | ✅ `(app)/trip/[id]/days`, one month at a time (swipe or arrows) | [mark-days](.claude/skills/verify-huddle/features/mark-days.md) |
| 12 | See overlap: which days suit most people | ✅ | ✅ `day_counts` | ✅ Everyone tab with a dot per person + best days on trip detail | [overlap](.claude/skills/verify-huddle/features/overlap.md) |
| 13 | Suggest a destination (title, note, link, image) | ✅ | ✅ `destinations` + link/length checks | ✅ `(app)/trip/[id]/suggest` | [suggest-destination](.claude/skills/verify-huddle/features/suggest-destination.md) |
| 14 | Vote on destinations | ✅ | ✅ `votes` | ✅ `(app)/trip/[id]/places` + top 3 on trip detail | [vote](.claude/skills/verify-huddle/features/vote.md) |
| 15 | Live updates while others vote and mark days | ✅ | ✅ realtime on availability, day_counts, destinations, votes, trips, trip_members | ✅ `useTripLive` on trip detail, days, places | [live-updates](.claude/skills/verify-huddle/features/live-updates.md) |
| 16 | Organiser locks the trip (dates + destination) | ✅ | ✅ `lock_trip()` + locked trips refuse new days, places and votes | ✅ `(app)/trip/[id]/lock` | [lock-trip](.claude/skills/verify-huddle/features/lock-trip.md) |
| 17 | Locked trip summary | ✅ | ✅ | ✅ summary on `(app)/trip/[id]`, dates on the trips list, share plan | [locked-summary](.claude/skills/verify-huddle/features/locked-summary.md) |
| 18 | Leave a trip | ✅ | ✅ delete policy + last-organiser guard, clears your days and votes | ✅ `Leave trip` in `(app)/trip/[id]/settings` | [leave-trip](.claude/skills/verify-huddle/features/leave-trip.md) |
| 19 | Organiser renames or deletes a trip | ✅ | ✅ | ✅ ⋯ button → `(app)/trip/[id]/settings` | [trip-settings](.claude/skills/verify-huddle/features/trip-settings.md) |
| 20 | Organiser hides who marked which day | ✅ | ✅ `trips.show_who_marked`; RLS returns only your own `availability` rows when off, counts come from `day_counts` | ✅ Privacy switch in `(app)/trip/[id]/settings` | [hide-who-marked](.claude/skills/verify-huddle/features/hide-who-marked.md) |

## Before launch

The planning loop above works end to end, but real friends can't use it yet. Work through these in order before handing Huddle to a real group. Hold off on bigger features (budgets, itinerary, chat, expenses) until this is done.

| # | Feature | Status | Why it matters | Notes |
|---|---|---|---|---|
| L1 | Production builds with EAS + a hosted web build | 🟡 | Nobody outside a dev machine can install or open the app, and invites only work if the friend can get it | iOS and Android store submission via `bunx eas-cli`; a hosted web build gives invite links somewhere to land. Done: tag-triggered APK + OTA release pipeline on GitHub Actions (needs EAS project and repo variables), and the app checks for OTA updates on resume (`use-update-check`). Left: `eas.json` has no build profiles yet (development / preview / production), no iOS build workflow, no hosted web deploy |
| L2 | Invite links that work for new users | 🟡 | Invites are the whole growth loop | Done: links are `https://<app>/invite/<code>`, a public invite page shows the trip (`invite_preview`), and the code survives sign-in (incl. the web Google redirect). Left, needs L1: set `EXPO_PUBLIC_APP_URL`, fill the Apple Team ID and Android SHA256 in `public/.well-known/`, then test universal/app links on a device. Tested on web: [invite-link](.claude/skills/verify-huddle/features/invite-link.md) |
| L3 | Google and Apple sign-in tested end to end | 🟡 | They are the only way real users can sign in; dev sign-in is dev-only | MVP rows 2 and 3: test Google against hosted Supabase, Apple in a development build |
| L4 | Push notifications | ⬜ | Without nudges people mark days once and drift off, and the organiser goes back to chasing them in the group chat | Start with "trip locked" and "vote now"; new votes later |
| L5 | Organiser can fix mistakes: unlock / re-plan, remove a member | ✅ | A wrong lock or an unwanted member today can only be fixed by deleting the trip | `unlock_trip()` + "organisers remove members" policy; both in `(app)/trip/[id]/settings`. Tested: [unlock-trip](.claude/skills/verify-huddle/features/unlock-trip.md), [remove-member](.claude/skills/verify-huddle/features/remove-member.md). A removed member can still rejoin with the code |
| L6 | Edit my profile (name, avatar) | ✅ | The display name comes from Google/Apple or the email prefix and can't be changed; also gives members avatars (MVP row 10) | `(app)/profile` (avatar on home): name + initials colour, sign out moved here; Apple's first-sign-in name now saved to the profile. Tested: [edit-profile](.claude/skills/verify-huddle/features/edit-profile.md) |

**Smaller checks before launch:**

| Check | Status | Notes |
|---|---|---|
| Empty trips list points to "create" and "join" | ✅ | Empty state card on home, with New trip and Join with a code always in the footer |
| Network drops / failed requests | 🟡 | Lists show an error and retry on focus/pull, the invite page has an offline state. No app-wide offline banner, and writes aren't queued (`src/lib/trips.ts` notes an offline-first store as a later step) |
| Optional date range on a trip | ⬜ | The calendar always shows a fixed 4-month window (`WINDOW_MONTHS` in `src/lib/dates.ts`); needs `trips.start/end` columns and an organiser control |
| Privacy policy | 🟡 | `/privacy` (public), linked from sign-in and profile; text in `src/lib/privacy.ts`. Tested: [privacy](.claude/skills/verify-huddle/features/privacy.md). Left: real controller name and contact email, and the hosted URL in the store listings (needs L1) |
| Delete my account | 🟡 | `/delete-account` from profile; `delete_my_account()` hands trips you organise alone to the longest-standing member, deletes trips with nobody else, keeps your places without your name. Tested: [delete-account](.claude/skills/verify-huddle/features/delete-account.md). Left: revoke the Sign in with Apple token on deletion (Apple requires it; needs an Apple key and a development build) |

## After launch: features that can be added

Nothing here is started. Ordered roughly by how much each one helps a group get from "let's go somewhere" to a booked trip. The schema today has `profiles`, `trips`, `trip_members`, `availability`, `destinations` and `votes`, so each idea below notes what it would add.

### Make planning smoother (small, builds on what exists)

| Idea | What it adds | Notes |
|---|---|---|
| "Maybe" days | A third state on `availability` (free / maybe) | Overlap would weight maybes lower; today a day is either marked or not |
| Edit a suggested place | Update policy on `destinations` for the author | Today a place can only be removed and re-added, which loses its votes |
| Comments on a place | `destination_comments` table + realtime | Keeps the "why this place" debate in the app instead of the group chat |
| Co-organisers | `promote_member()` / `demote_member()` functions | Only the creator is organiser; the last-organiser guard already exists |
| Reset the invite code | `regenerate_invite_code(trip)` function | For when a link leaks; old links stop working |
| Voting deadline | `trips.vote_until` + a countdown on trip detail | Pairs well with push notifications (L4): "voting closes tomorrow" |
| Nudge people who haven't marked days | Uses `availability` + push | Organiser taps "nudge" on members with no days marked |

### After the trip is locked

| Idea | What it adds | Notes |
|---|---|---|
| Add to calendar | `.ics` export of the locked dates | No schema change; works on all three platforms |
| Day-by-day itinerary | `itinerary_items` (day, time, title, place, link) | The locked summary becomes the trip's home page |
| Shared packing / to-do list | `trip_tasks` with assignee and done flag | Simple, high reuse, good realtime fit |
| Bookings and links | `trip_links` (flights, stays, tickets) | Could start as typed links on the itinerary |
| Budget per person | `trips.budget_min/max` or a poll before locking | Helps pick between destinations before booking |
| Expense splitting | `expenses` + `expense_shares` and a "who owes whom" view | Largest item here; worth doing only once people use the app during the trip |

### Platform and quality

| Idea | Notes |
|---|---|
| Offline-first local store | Already planned in `src/lib/trips.ts`; cache trips and queue writes so days and votes work without signal |
| Crash and error reporting | Nothing reports production errors today; add a crash reporter before the first real group |
| Product analytics | A handful of events (trip created, invite opened, joined, locked) to see where groups drop off |
| Map and weather on places | Map preview and typical weather for the trip dates on each destination card |
| Localisation | Copy is English-only and dates already go through `Intl`; strings would need extracting |
| Accessibility pass | Screen reader labels exist in places; a full VoiceOver/TalkBack pass and dynamic type check |
| Home-screen widget / Live Activity | Countdown to a locked trip; native-only, needs a development build |
