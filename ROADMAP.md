# Huddle roadmap

What the MVP needs, and where each piece stands. Update the status when work lands. Last checked against the code on 14 Nov 2026.

**Status key:** ✅ Done · 🟡 Partly done · ⬜ To do

"Database" means the table, row-level security and functions are already in `supabase/migrations/`. "Tested" links to the matching feature file in the verify-huddle skill.

## MVP: plan a trip together

| # | Feature | Status | Database | App | Tested |
|---|---|---|---|---|---|
| 1 | Dev sign-in (seeded users) | ✅ | ✅ | ✅ `sign-in`: welcome scene with Pip, dev chips under "Developer sign-in" | [sign-in](.claude/skills/verify-huddle/features/sign-in.md) |
| 2 | Google sign-in | 🟡 | ✅ | ✅ coded, not tested against hosted Supabase | |
| 3 | Apple sign-in (iPhone) | 🟡 | ✅ | ✅ coded, needs a development build to test | |
| 4 | Sign out | ✅ | | ✅ `Sign out` row on the You tab (`(app)/(home)/profile`) | [sign-out](.claude/skills/verify-huddle/features/sign-out.md) |
| 5 | Trips list (home) | ✅ | ✅ `trip_summaries()` + `trip_stats` feed the chips | ✅ Trips tab (`(app)/(home)/index`): Pip's hero card (nudge, vote, countdown or start a trip), trip cards with a status chip (`Your vote needed`, `Voting open`, `Planning days`, `Done`) and a countdown, cover or colour tile | [trips-list](.claude/skills/verify-huddle/features/trips-list.md) |
| 6 | Create a trip (name + colour) | ✅ | ✅ five colours (`iris`, `beak`, `mint`, `blush`, `coral`); old keys are remapped by a trigger | ✅ `(app)/new-trip`, two steps: name, colour and dates ("Let the group vote" or "I already know"), then the invite panel | [create-trip](.claude/skills/verify-huddle/features/create-trip.md) |
| 7 | Open a trip | ✅ | ✅ | ✅ Trip tab (`(app)/trip/[id]/(tabs)/index`): hero (best days or countdown), Vote / Plan / Split / Photos tiles, Pip's next step, `Trip settings` row; the trip has its own tab bar (Trip, Vote, Plan, Split, Photos + Ask Pip) | [trip-detail](.claude/skills/verify-huddle/features/trip-detail.md) |
| 8 | Share invite code / link | ✅ | ✅ `trips.invite_code` | ✅ invite sheet `(app)/trip/[id]/invite` (the + or the faces in the trip header, Pip's `Invite`, step 2 of a new trip): code tiles, `Copy link`, `Share` | [invite-share](.claude/skills/verify-huddle/features/invite-share.md) |
| 9 | Join a trip by invite code | ✅ | ✅ `join_trip(code)` | ✅ Invites tab (`(app)/(home)/join`): takes a code or a pasted invite link, `Paste` chip | [join-trip](.claude/skills/verify-huddle/features/join-trip.md) |
| 10 | See trip members | ✅ | ✅ `trip_members` | ✅ face stack in the trip header; "In the huddle · N" with join times in the invite sheet; People in settings | [trip-detail](.claude/skills/verify-huddle/features/trip-detail.md) |
| 11 | Mark the days I'm free | ✅ | ✅ `availability` | ✅ Vote tab → `Dates` → `My days`, one month at a time; the old `trip/[id]/days` route redirects there | [mark-days](.claude/skills/verify-huddle/features/mark-days.md) |
| 12 | See overlap: which days suit most people | ✅ | ✅ `day_counts` | ✅ Vote tab → `Dates` → `Everyone` (heatmap, dots per person) + `Best days` card; the Trip tab hero shows the best range | [overlap](.claude/skills/verify-huddle/features/overlap.md) |
| 13 | Suggest a destination (title, note, link, photo) | ✅ | ✅ `destinations` + link/length checks; photos in the private `place-photos` bucket, members only | ✅ `(app)/trip/[id]/suggest` sheet from Vote → `Places` (`Suggest a place`) or Pip: choose or take a photo, cropped to 16:9 at 1600×900; a copy kept in the device's `huddle/` folder; the top place's photo is the trip's cover on the home card when it has no countdown | [suggest-destination](.claude/skills/verify-huddle/features/suggest-destination.md) |
| 14 | Vote on destinations | ✅ | ✅ `votes` | ✅ Vote tab → `Places`: cards with a progress bar and `Leading` badge, tap to open details; the old `trip/[id]/places` route redirects there; the Vote tile on the Trip tab shows the leader | [vote](.claude/skills/verify-huddle/features/vote.md) |
| 15 | Live updates while others vote and mark days | ✅ | ✅ realtime on availability, day_counts, destinations, votes, trips, trip_members, itinerary_items, expenses, settlements, trip_photos | ✅ `useTripLive` on the Trip, Vote, Plan, Split and Photos tabs, the invite panel, settings and the lock sheet | [live-updates](.claude/skills/verify-huddle/features/live-updates.md) |
| 16 | Organiser locks the trip (dates + destination) | ✅ | ✅ `lock_trip()` + locked trips refuse new days, places and votes | ✅ `(app)/trip/[id]/lock` sheet from Pip's `Lock` or settings → Plan; then the celebration screen | [lock-trip](.claude/skills/verify-huddle/features/lock-trip.md) |
| 17 | Locked trip summary | ✅ | ✅ | ✅ summary card on the Trip tab (photo, Where / When, nights, who's going with a countdown, `Share plan`, `Add to calendar`); dates on the home card | [locked-summary](.claude/skills/verify-huddle/features/locked-summary.md) |
| 18 | Leave a trip | ✅ | ✅ delete policy + last-organiser guard, clears your days and votes; expenses and photos stay | ✅ `Leave trip` in `(app)/trip/[id]/settings` (members), with your open balance in the confirmation | [leave-trip](.claude/skills/verify-huddle/features/leave-trip.md) |
| 19 | Organiser renames or deletes a trip | ✅ | ✅ | ✅ `Trip settings` row at the bottom of the Trip tab → `(app)/trip/[id]/settings`; colour changes save at once; delete removes the trip's place and album photos first | [trip-settings](.claude/skills/verify-huddle/features/trip-settings.md) |
| 20 | Organiser hides who marked which day | ✅ | ✅ `trips.show_who_marked`; RLS returns only your own `availability` rows when off, counts come from `day_counts` | ✅ Privacy switch in `(app)/trip/[id]/settings` | [hide-who-marked](.claude/skills/verify-huddle/features/hide-who-marked.md) |

None of the rows above has been driven with verify-huddle since the redesign (commits `2ca5728`…`1b0ae8d`); each feature file was rewritten for the new screens and says when it was last proven.

## Built with the redesign

Planned for "after launch", built early alongside the new design. Everything here is web-checked by unit tests only so far: none has a verify-huddle run yet, and none has been tried on a device or against hosted Supabase.

| # | Feature | Status | Database | App | Tested |
|---|---|---|---|---|---|
| R1 | New look: Pip, tab bars, five trip colours, new icons | 🟡 | ✅ `…_huddle_colours.sql` | ✅ `src/components/pip`, `src/components/nav`, `src/theme/tokens.ts`; home tabs Trips / Invites / You with a Pip button that starts a trip; trip tabs Trip / Vote / Plan / Split / Photos with Ask Pip. Left: a new native build. `react-native-svg` (icons, Pip) and the new app icons are native changes, so they can't ship as an OTA update (`runtimeVersion` uses the fingerprint policy) | covered by every feature file |
| R2 | Fixed dates (organiser sets them instead of a vote) | ✅ | ✅ `trips.fixed_start/fixed_end` | ✅ "I already know" in new trip and settings → Dates; the Vote → Dates segment shows "Dates are set"; the lock sheet prefills them; Plan opens straight away | [fixed-dates](.claude/skills/verify-huddle/features/fixed-dates.md) |
| R3 | Day-by-day plan ("Plan") | ✅ | ✅ `itinerary_items`; only on the trip's dates (locked, else fixed); author or organiser edits | ✅ Plan tab: day chips, each day's plans by time, `Add to <weekday>`; `(app)/trip/[id]/plan-item` sheet; plans left off the dates after a re-lock are listed separately | [plan](.claude/skills/verify-huddle/features/plan.md) |
| R4 | Expenses ("Split") | ✅ | ✅ `expenses`, `expense_shares`, `settlements`, `save_expense()` splits equally in SQL, `trips.currency` (INR, no UI to change it) | ✅ Split tab: balance card, who owes whom (simplified), feed; `(app)/trip/[id]/expense` and `(app)/trip/[id]/settle` sheets; undo your own payment | [add-expense](.claude/skills/verify-huddle/features/add-expense.md), [settle-up](.claude/skills/verify-huddle/features/settle-up.md) |
| R5 | Trip album ("Photos") | ✅ | ✅ `trip_photos` + private `trip-photos` bucket, full photo (≤2048px) and 512px thumbnail | ✅ Photos tab: masonry grid, `All` / `Day N` / `Mine` chips, who hasn't added photos; full-screen viewer `(app)/trip/[id]/photo/[photoId]` with delete. Left: EXIF dates and `Take a photo` are native-only | [photos](.claude/skills/verify-huddle/features/photos.md) |
| R6 | Add to calendar | 🟡 | none needed | ✅ `Add to calendar` on the locked summary and the celebration screen (`src/lib/calendar.ts`): web downloads `<trip-name>.ics`; iOS shares an `.ics` file; Android opens a Google Calendar link (a file would need `expo-sharing` and a new native build). Left: iOS and Android untested | [add-to-calendar](.claude/skills/verify-huddle/features/add-to-calendar.md) (web only) |
| R7 | Nudge people (share sheet) | 🟡 | `trip_summaries()` counts, never names | ✅ `Nudge them` on the home hero (people who haven't marked days) and Pip's `Nudge` on the Trip tab (people who haven't voted) open the share sheet; web without the Web Share API copies the message. Push nudges are still L4 | [nudge](.claude/skills/verify-huddle/features/nudge.md) |
| R8 | Lock celebration | ✅ | | ✅ `(app)/trip/[id]/locked` full screen with confetti, shown once per trip per device (and again after an unlock and re-lock) | [locked-celebration](.claude/skills/verify-huddle/features/locked-celebration.md) |

## Before launch

The planning loop above works end to end, but real friends can't use it yet. Work through these in order before handing Huddle to a real group. The itinerary, expenses and album were built early with the redesign (see above); hold off on further big features (budgets, chat) until this is done.

| # | Feature | Status | Why it matters | Notes |
|---|---|---|---|---|
| L1 | Production builds with EAS + a hosted web build | 🟡 | Nobody outside a dev machine can install or open the app, and invites only work if the friend can get it | iOS and Android store submission via `bunx eas-cli`; a hosted web build gives invite links somewhere to land. Done: tag-triggered APK + OTA release pipeline on GitHub Actions (needs EAS project and repo variables), and the app checks for OTA updates on resume (`use-update-check`). Left: `eas.json` has no build profiles yet (development / preview / production), no iOS build workflow, no hosted web deploy. The redesign added `react-native-svg` and new app icons, so the next release needs a new native build, not an OTA update |
| L2 | Invite links that work for new users | 🟡 | Invites are the whole growth loop | Done: links are `https://<app>/invite/<code>`, a public invite page shows the trip (`invite_preview`), and the code survives sign-in (incl. the web Google redirect). Left, needs L1: set `EXPO_PUBLIC_APP_URL`, fill the Apple Team ID and Android SHA256 in `public/.well-known/`, then test universal/app links on a device. Signed in, a link opens the Invites tab with the code filled in. Tested on web: [invite-link](.claude/skills/verify-huddle/features/invite-link.md) |
| L3 | Google and Apple sign-in tested end to end | 🟡 | They are the only way real users can sign in; dev sign-in is dev-only | MVP rows 2 and 3: test Google against hosted Supabase, Apple in a development build |
| L4 | Push notifications | ⬜ | Without nudges people mark days once and drift off, and the organiser goes back to chasing them in the group chat | Start with "trip locked" and "vote now"; new votes later. Until then `Nudge them` / Pip's `Nudge` hand a message to the share sheet (R7) |
| L5 | Organiser can fix mistakes: unlock / re-plan, remove a member | ✅ | A wrong lock or an unwanted member today can only be fixed by deleting the trip | `unlock_trip()` + "organisers remove members" policy; both in `(app)/trip/[id]/settings` (Plan and People sections). Tested: [unlock-trip](.claude/skills/verify-huddle/features/unlock-trip.md), [remove-member](.claude/skills/verify-huddle/features/remove-member.md). A removed member can still rejoin with the code |
| L6 | Edit my profile (name, avatar) | ✅ | The display name comes from Google/Apple or the email prefix and can't be changed; also gives members avatars (MVP row 10) | You tab (`(app)/(home)/profile`, also the avatar on the Trips tab): name + initials colour, privacy, delete account and sign out; Apple's first-sign-in name now saved to the profile. Tested: [edit-profile](.claude/skills/verify-huddle/features/edit-profile.md) |

**Smaller checks before launch:**

| Check | Status | Notes |
|---|---|---|
| Empty trips list points to "create" and "join" | ✅ | No trips: Pip's hero card offers `Start a trip` and `Join with a code`, above a "Start your first trip" card. The Pip button in the tab bar always starts a trip and the Invites tab always joins one |
| Network drops / failed requests | 🟡 | Lists show an error and retry on focus (Photos also on pull), the invite page has an offline state. No app-wide offline banner, and writes aren't queued (`src/lib/trips.ts` notes an offline-first store as a later step) |
| Optional date range on a trip | ✅ | Done as fixed dates (R2): `trips.fixed_start/fixed_end`, set by the organiser with "I already know". The voting calendar still shows a fixed 4-month window (`WINDOW_MONTHS` in `src/lib/dates.ts`). Tested: [fixed-dates](.claude/skills/verify-huddle/features/fixed-dates.md) |
| Privacy policy | 🟡 | `/privacy` (public), linked from sign-in ("privacy policy" link) and the You tab; text in `src/lib/privacy.ts`. Tested: [privacy](.claude/skills/verify-huddle/features/privacy.md). Left: real controller name and contact email, and the hosted URL in the store listings (needs L1) |
| Delete my account | 🟡 | `/delete-account` from the You tab; `delete_my_account()` hands trips you organise alone to the longest-standing member, deletes trips with nobody else, keeps your places, plans and expenses without your name (your debts are written off pair by pair), and deletes your album photos (the app removes the files first). Tested: [delete-account](.claude/skills/verify-huddle/features/delete-account.md). Left: revoke the Sign in with Apple token on deletion (Apple requires it; needs an Apple key and a development build) |

## After launch: features that can be added

Nothing here is started. Ordered roughly by how much each one helps a group get from "let's go somewhere" to a booked trip. The schema today has `profiles`, `trips`, `trip_members`, `availability`, `destinations`, `votes`, `itinerary_items`, `expenses`, `expense_shares`, `settlements` and `trip_photos`, so each idea below notes what it would add. Add to calendar, the itinerary and expense splitting moved up to "Built with the redesign".

### Make planning smoother (small, builds on what exists)

| Idea | What it adds | Notes |
|---|---|---|
| "Maybe" days | A third state on `availability` (free / maybe) | Overlap would weight maybes lower; today a day is either marked or not |
| Edit a suggested place | Update policy on `destinations` for the author | Today a place can only be removed and re-added, which loses its votes |
| Comments on a place | `destination_comments` table + realtime | Keeps the "why this place" debate in the app instead of the group chat |
| Co-organisers | `promote_member()` / `demote_member()` functions | Only the creator is organiser; the last-organiser guard already exists |
| Reset the invite code | `regenerate_invite_code(trip)` function | For when a link leaks; old links stop working |
| Voting deadline | `trips.vote_until` + a countdown on trip detail | Pairs well with push notifications (L4): "voting closes tomorrow" |
| Push nudges | Uses `trip_summaries()` counts + push (L4) | Today's nudge (R7) only hands a message to the share sheet; a push could reach the people who haven't marked days or voted directly |
| Server-side photo cleanup | Edge function or scheduled job removing `place-photos/<trip_id>/` and `trip-photos/<trip_id>/` once a trip is gone | SQL can't delete Storage files, so the app removes them before deleting a trip or an account (`removeTripPhotos`). If that client step fails or is skipped, the files stay in the bucket |
| Fill a place in from a pasted link | Edge function reading the page's title and preview image | Paste an Airbnb or blog link and the name and photo fill in |
| Several photos per place | Up to 3 under `place-photos/<trip_id>/<place_id>-n.jpg`, swiped on the card | The bucket layout already allows it |

### After the trip is locked

| Idea | What it adds | Notes |
|---|---|---|
| Shared packing / to-do list | `trip_tasks` with assignee and done flag | Simple, high reuse, good realtime fit |
| Bookings and links | `trip_links` (flights, stays, tickets) | Could start as typed links on plan items (`itinerary_items` has a note but no link) |
| Budget per person | `trips.budget_min/max` or a poll before locking | Helps pick between destinations before booking |
| Pick the trip currency | A control for `trips.currency` (today always `INR`) | Changing it after expenses exist would relabel every amount, so it needs a rule |
| Uneven expense splits | Custom shares in `save_expense()` | Today every expense splits equally |

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
