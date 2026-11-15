# Huddle feature map

Every user-facing feature, how to reach it on web, and what proves it works. Keep this in step with `src/app/` — `/pstack:maintain-verification-skill` checks for drift.

Routes: the home tabs are `(app)/(home)/` (`/` Trips, `/join` Invites, `/profile` You). A trip's tabs are `(app)/trip/[id]/(tabs)/` (`/trip/[id]` Trip, `/vote`, `/plan`, `/split`, `/photos`). Sheets and full-screen pages sit next to them in `(app)/trip/[id]/`. `/trip/[id]/days` and `/trip/[id]/places` only redirect to the Vote tab.

Every file was rewritten for the redesign (commits `2ca5728`…`1b0ae8d`); none has been re-proven on the new screens yet. "Last proven" gives the last run on the old UI where there was one.

| Feature | Route(s) | File | Last proven |
|---|---|---|---|
| Dev sign-in | `/sign-in` | [sign-in.md](sign-in.md) | old UI 2026-11-11 |
| Trips list (home) | `/` | [trips-list.md](trips-list.md) | old UI 2026-11-11 |
| Create trip | `/` (Pip button) → `/new-trip` (2 steps) | [create-trip.md](create-trip.md) | old UI 2026-11-11 |
| Fixed dates | `/new-trip`, `/trip/[id]/settings`, `/trip/[id]/vote?seg=dates` | [fixed-dates.md](fixed-dates.md) | not yet |
| Sign out | `/profile` (You) | [sign-out.md](sign-out.md) | old UI 2026-11-12 |
| Edit my profile | `/profile` (You) | [edit-profile.md](edit-profile.md) | old UI 2026-11-12 |
| Trip detail (Trip tab) | `/` → `/trip/[id]` | [trip-detail.md](trip-detail.md) | old UI 2026-11-11 |
| Share invite code / link | `/trip/[id]` → `/trip/[id]/invite`; `/new-trip` step 2 | [invite-share.md](invite-share.md) | old UI 2026-11-12 |
| Invite link (signed out → sign in → join) | `/invite/[code]` → `/sign-in` → `/join` | [invite-link.md](invite-link.md) | old UI 2026-11-12 |
| Join a trip by code | `/join` (Invites) | [join-trip.md](join-trip.md) | old UI 2026-11-11 |
| Mark my free days | `/trip/[id]/vote?seg=dates` (My days) | [mark-days.md](mark-days.md) | old UI 2026-11-11 |
| See overlap | `/trip/[id]/vote?seg=dates` (Everyone), `/trip/[id]` | [overlap.md](overlap.md) | old UI 2026-11-11 |
| Suggest a destination | `/trip/[id]/vote` → `/trip/[id]/suggest` | [suggest-destination.md](suggest-destination.md) | old UI 2026-11-14 |
| Vote on destinations | `/trip/[id]/vote?seg=places` | [vote.md](vote.md) | old UI 2026-11-11 |
| Nudge people | `/`, `/trip/[id]` | [nudge.md](nudge.md) | not yet |
| Live updates | every trip tab, invite panel, settings, lock | [live-updates.md](live-updates.md) | old UI 2026-11-11 |
| Rename, recolour or delete a trip | `/trip/[id]` → `/trip/[id]/settings` | [trip-settings.md](trip-settings.md) | old UI 2026-11-11 |
| Hide who marked which day | `/trip/[id]/settings`, `/trip/[id]/vote?seg=dates` | [hide-who-marked.md](hide-who-marked.md) | not yet |
| Leave a trip | `/trip/[id]` → `/trip/[id]/settings` | [leave-trip.md](leave-trip.md) | old UI 2026-11-11 |
| Unlock a trip | `/trip/[id]` → `/trip/[id]/settings` | [unlock-trip.md](unlock-trip.md) | old UI 2026-11-12 |
| Remove a member | `/trip/[id]` → `/trip/[id]/settings` | [remove-member.md](remove-member.md) | old UI 2026-11-12 |
| Lock the trip | `/trip/[id]` (Pip) or settings → `/trip/[id]/lock` | [lock-trip.md](lock-trip.md) | old UI 2026-11-11 |
| Lock celebration | `/trip/[id]/lock` or first visit → `/trip/[id]/locked` | [locked-celebration.md](locked-celebration.md) | not yet |
| Locked trip summary | `/`, `/trip/[id]` | [locked-summary.md](locked-summary.md) | old UI 2026-11-11 |
| Add to calendar (web download) | `/trip/[id]`, `/trip/[id]/locked` | [add-to-calendar.md](add-to-calendar.md) | not yet |
| Day-by-day plan | `/trip/[id]/plan` → `/trip/[id]/plan-item` | [plan.md](plan.md) | not yet |
| Add an expense | `/trip/[id]/split` → `/trip/[id]/expense` | [add-expense.md](add-expense.md) | not yet |
| Settle up | `/trip/[id]/split` → `/trip/[id]/settle` | [settle-up.md](settle-up.md) | not yet |
| Trip album | `/trip/[id]/photos` → `/trip/[id]/photo/[photoId]` | [photos.md](photos.md) | not yet |
| Privacy policy | `/sign-in` or `/profile` → `/privacy` | [privacy.md](privacy.md) | old UI 2026-11-14 |
| Delete my account | `/profile` → `/delete-account` | [delete-account.md](delete-account.md) | old UI 2026-11-14 (isolated stack) |
