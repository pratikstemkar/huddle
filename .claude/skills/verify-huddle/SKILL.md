---
name: verify-huddle
description: Drive the Huddle Expo app on web (Expo Router + local Supabase) the way a user does and prove a change works — sign in as a seeded dev user, click through trip screens in the built-in browser, and check the resulting Supabase rows. Use before declaring any user-facing Huddle change done.
---

# Verify Huddle

Primary surface: the Expo app rendered on **web** (`react-native-web`), driven with the built-in browser (`mcp__Claude_Browser__*`). Backend: **local Supabase** (Docker) on `127.0.0.1:54321`, with RLS on every table. iOS/Android are not covered here; a native-only change (haptics, Apple sign-in, `formSheet` detents, the share sheet, the camera, EXIF photo dates, iOS/Android add-to-calendar) needs a dev build and stays unverified by this skill — say so.

Feature map: [`features/README.md`](features/README.md). A proof covers every entry point the map lists for the feature you touched.

## Launch

1. **Supabase.** Usually already running. If doctor says the API is down: `bun run db:start` (first start applies `supabase/migrations/` and `supabase/seed.sql`). The Supabase CLI talks to Docker; in a sandboxed agent shell it fails with `permission denied ... docker.sock` — rerun outside the sandbox or ask the user to run it.
   - From an empty DB: `bun run db:start` is enough. `bun run db:reset` also rebuilds from seed but **wipes the user's local trips** — ask first.
2. **Env + deps.** `.env.local` must exist with `EXPO_PUBLIC_DEV_AUTH=true`, and `node_modules` must be installed. A fresh git worktree has neither: run `bun install` and copy `.env.local` from the main checkout. Expo reads `.env.local` at start; restart Expo after changing it.
3. **Pick this checkout's slot.** Several worktrees may verify at once against the one shared local Supabase. Run
   `eval "$(.claude/skills/verify-huddle/scripts/slot.sh)"` → `CONFIG` (e.g. `web-verify-3`), `PORT` (8091–8096), `PREFIX` (e.g. `verify-cd9004-`).
   `PREFIX` is a hash of this checkout's path, so it's stable across runs. `PORT` is the slot the path hashes to, skipping any port another checkout already holds. Shell state doesn't persist between Bash calls: re-run the `eval` in each call that needs the values, or note them once.
4. **Web app — isolated instance.** The user often runs their own Expo on `:8081`; never drive or kill it. `preview_start {name: "<CONFIG>"}` (slots defined in `.claude/launch.json`). Keep the returned `serverId` and `tabId`.
   Separate port = separate origin = separate `localStorage` session, so each worktree and the user's 8081 keep their own sign-ins.
5. **Ready = usable.** Metro only bundles on the first request, so the first page can be blank. `navigate` to `http://localhost:<PORT>/` again, wait until `preview_logs` shows `Web Bundled`, then `find "Sign in as"` must return 4 buttons. Blank `get_page_text` after that = a crash: read `read_console_messages {onlyErrors: true}`.

## Doctor

```bash
.claude/skills/verify-huddle/scripts/doctor.sh
```

Read-only. Prints this checkout's slot, then checks `node_modules`, `.env.local` + dev auth flag, Supabase API health, that seeded `aarav@dev.test` can sign in and read trips (proves migrations + seed + RLS), and that Expo answers on this checkout's port (`slot.sh` already guarantees the port is free or held by this checkout). Run it first and whenever anything looks off. Exit 0 = worth driving.

## Drive

Use accessibility handles via `find` / `read_page`, then click by `ref`. Never coordinates or tab order. Handles in this repo:

| Screen (route) | Handle | Kind |
|---|---|---|
| `/sign-in` | `Sign in as Aarav` / `Meera` / `Kabir` / `Zoya` | button (only when `__DEV__` + `EXPO_PUBLIC_DEV_AUTH=true`) |
| `/sign-in` | `Continue with Google` | button — real OAuth, **do not drive** |
| `/sign-in` | `privacy policy` | link (in the footer sentence) |
| home tabs (`/`, `/join`, `/profile`) | `Trips` / `Invites` / `You` | tab |
| home tabs | `Pip: start a new trip` | button (round Pip at the end of the tab bar) → `/new-trip` |
| `/` (Trips) | `Your profile` | button (the avatar, top right) → `/profile` |
| `/` | `Nudge them` / `Vote` / `Open` / `Start a trip` / `Join with a code` | button on Pip's hero card (which one depends on your trips) |
| `/` | `<trip name>, <chip>[, <dates>]` | button per trip card, e.g. `Goa in March, Voting open` |
| `/new-trip` step 1 | `Close`, `Trip name` (textbox, max 60) | |
| `/new-trip` step 1 | `Iris` `Beak yellow` `Mint` `Blush` `Coral` | radio (trip colour; default Iris) |
| `/new-trip` step 1 | `Let the group vote` / `I already know` | radio (dates) |
| `/new-trip`, settings | `Previous month` / `Next month`, `<Weekday>, <Month> <day>[, first day / last day / in your dates]` | date range picker |
| `/new-trip` step 1 | `Next: invite people` | button → step 2 (trip is created) |
| `/new-trip` step 2 | `Back`, `Go to the trip` | button |
| `/join` (Invites) | `Invite code` | textbox (code or pasted link) |
| `/join` | `Paste invite code` / `Join trip` | button |
| `/invite/[code]` | `Sign in to join` / `Go to Huddle` | button (signed out) |
| `/profile` (You) | `Your name` | textbox (max 40) |
| `/profile` | `Iris` … `Coral` | radio (avatar colour), or `Use my initial instead` with a sign-in photo |
| `/profile` | `Save profile`, `Privacy policy`, `Delete account`, `Sign out` | button |
| `/privacy` | `Back` / `Done` | button |
| `/delete-account` | `Type DELETE to confirm` | textbox |
| `/delete-account` | `Delete my account` / `Keep my account` | button (**isolated stack only**) |
| trip tabs (`/trip/[id]/…`) | `Trip` / `Vote` / `Plan` / `Split` / `Photos` | tab |
| trip tabs | `Ask Pip` | button; its hint names what it does on this tab (`Add expense`, `Add photos`, `Add to <Weekday>`, …) |
| `/trip/[id]` (Trip) | `Back to your trips`, `Invite people`, `<n> people in the huddle` | button |
| `/trip/[id]` | `<trip>. <title>. <sub>` | hero; a button (→ Vote → Dates) while the trip has no dates |
| `/trip/[id]` | `Vote, …` / `Plan, …` / `Split, …` / `Photos, …` | button per tile |
| `/trip/[id]` | Pip's button: `Lock in the plan` (shown as `Lock`), `Mark days`, `Suggest`, `Vote`, `Invite`, `Nudge`, `See votes`, `Share`, `Plan`, `Split`, `Photos` | button |
| `/trip/[id]` | `Trip settings` | button (row at the bottom) |
| `/trip/[id]` (locked) | `Share plan` / `Add to calendar` | button |
| `/trip/[id]/invite` | `Copy link` / `Share` / `Done` / `Close`; `Invite code <letters>` | button; the code tiles |
| `/trip/[id]/vote` | `Places` / `Dates` | tab (segment; `?seg=places` or `?seg=dates` picks one) |
| Vote → Places | `<title>, N votes` (opens details), `Vote for <title>` / `Remove your vote for <title>`, `Remove <title>`, `Suggest a place` | button |
| Vote → Dates | `My days` / `Everyone` | tab |
| Vote → Dates | `<Weekday>, <Month> <day>[, you are free][, N of M free][: names]` | button per day |
| Vote → Dates | `Previous month` / `Next month` / `Back to this month` | button |
| `/trip/[id]/suggest` | `Place name` / `Note` / `Link` (textbox), `Choose photo`, `Add place`, `Close` | |
| `/trip/[id]/lock` | best-range radios `<range>, N of M free`, `Start date` / `End date` (textbox), place radios `<title>, N votes`, `Lock in the plan` | |
| `/trip/[id]/locked` | `Start planning the days` / `Add to calendar` / `Close` | button |
| `/trip/[id]/settings` | `Trip name`, `Save name`, colour radios, `Let the group vote` / `I already know`, `Save dates` | organiser |
| `/trip/[id]/settings` | `Lock in the plan` or `Unlock and re-plan` → `Yes, unlock` | button (organiser) |
| `/trip/[id]/settings` | `Show who marked each day` | switch (organiser) |
| `/trip/[id]/settings` | `Remove <name>` → `Yes, remove <name>`; `Delete trip` → `Yes, delete forever` | button (organiser) |
| `/trip/[id]/settings` | `Leave trip` → `Yes, leave trip` | button (members) |
| `/trip/[id]/plan` | `<Weekday>, <Month> <day>, N plans` | button per day chip |
| `/trip/[id]/plan` | `Add to <Weekday>`; a plan row `<time>, <title>, <note · added by …>` | button |
| `/trip/[id]/plan-item` | day chips `<Weekday>, <Month> <day>`, `Time`, `Set the time to 9:00` / `13:00` / `18:00`, `Title`, `Note` | |
| `/trip/[id]/plan-item` | `Add to <Weekday>` or `Save changes`; `Delete this plan` → `Yes, delete` | button |
| `/trip/[id]/split` | `Add expense`, `Settle up`; feed rows `<title>, <amount>, <who paid · split N ways>` | button |
| `/trip/[id]/expense` | `Amount`, `What for` (textbox); `Stay` `Travel` `Food` `Other`; `Paid by <name>`; `Split with <name>`; `Save expense` / `Delete expense` | |
| `/trip/[id]/settle` | `Amount, You owe <name>` / `Amount, <name> owes you` (textbox), `I paid <name>` / `<name> paid me` | |
| `/trip/[id]/photos` | `Add photos` (header `Add`), `Add yours`, chips `All` / `Day N` / `Mine`, tiles `Photo, <who>[ · Day N]` | button |
| `/trip/[id]/photo/[photoId]` | `Close`, `Previous photo` / `Next photo` (web), `Delete photo` | button |

On web every sheet (`formSheet`) and full-screen modal renders as a normal page at its route. The trip and home tab bars stay in the accessibility tree under a screen pushed on top, so `find` can return a tab from the screen underneath: pick the match from the screen you're on.

Batch predictable steps with `browser_batch` (click → wait 1–2s → `get_page_text`). The URL in each result's tab context confirms navigation (`/sign-in` → `/` → `/new-trip` → `/trip/<id>`).

Seeded data (`supabase/seed.sql`, after `db:reset`; dates are relative to the day it ran): users Aarav (`1111…`), Meera (`2222…`), Kabir (`3333…`), Zoya (`4444…`), all with password `trip-dev-password`. Trip ids are `aaaaaaaa-0000-0000-0000-00000000000N`:

| N | Trip (invite) | Organiser · members | State |
|---|---|---|---|
| 1 | Goa in March (`goa2027`), coral | Aarav · Meera | planning; Aarav free days +10…+16, Meera +13…+19; Palolem Beach (2 votes), Old Goa and Fontainhas (1), Anjuna flea market (0) |
| 2 | Pondy long weekend (`pondy27`), mint | Aarav · Meera, Kabir, Zoya | locked +40…+42 to Pondicherry; plans on days 1 and 2; three expenses (₹18,400) and Zoya paid Meera ₹500, so Aarav is owed ₹7,116.66 |
| 3 | Hampi surprise (`hampi27`), beak | Meera · Aarav, Kabir | planning, `show_who_marked = false`; days around +20…+27; no places |
| 4 | Coorg weekend (`coorg26`), blush | Zoya · Aarav, Meera, Kabir | locked −60…−58 (over: `Done` chip); Homestay ₹8,000 paid by Zoya, split 4 ways |
| 5 | Udaipur in winter (`udaipur27`), iris | Kabir · Aarav, Zoya | planning with fixed dates +70…+73; Lake Pichola (Kabir's vote), Kumbhalgarh; one plan on day 1 |

Every seeded user is now in some trip, so nobody sees the empty home. Zoya is not in Goa or Hampi and Kabir is not in Goa, which is what the join tests use. The user's local DB may hold extra trips they made — never delete those.

**Migrations on this branch.** The redesign adds `20261122…20261127` (colours, fixed dates, itinerary, expenses, album, stats). Until they're on `main`, the shared local Supabase may not have them: check with `docker exec supabase_db_group-trip-planner psql -U postgres -c "select version from supabase_migrations.schema_migrations order by 1 desc limit 6"`. If they're missing, use an isolated stack (AGENTS.md → "Local testing alongside other checkouts") rather than applying them to the shared DB.

**Locked trips open a celebration.** The first time this browser opens a locked trip (seeded Pondy and Coorg included), the Trip tab pushes `/trip/[id]/locked`; `Close` goes back. It's remembered per trip in `localStorage['huddle.lockedSeen.<trip id>']`. See [locked-celebration](features/locked-celebration.md).

**Test data rule:** start every trip name you create with this checkout's `PREFIX` (e.g. `verify-cd9004-lagoon`) so only your cleanup finds it, and never edit or delete anything else. Other worktrees' `verify-…` rows may be in the list mid-run; ignore them.

## Evidence

Put each run's proof in `.verify-evidence/<YYYYMMDD-HHMMSS>-<feature>/` (git-ignored). A complete proof has:

1. `before.json` — DB state before the action:
   `node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs trips <email> --out <run>/before.json`
2. The UI path: the `get_page_text` after each step, and a `screenshot` of the end state. Screenshot images are saved under the session's `tool-results/` folder (the path is printed with the image); `cp` the final one into the run folder.
3. `after.json` — the same `db.mjs trips` call afterwards. Assert the side effect (row exists, right `color`, the `trip_members` role), not only what's on screen. `db.mjs` only reads trips and members; for plans, expenses, settlements, photos or fixed dates, read the rows with a `select` through `docker exec supabase_db_<project_id> psql -U postgres` (read-only) or supabase-js signed in as the user.
4. For anything shared between users, an RLS check as a second user (`db.mjs trips meera@dev.test --out <run>/rls-meera.json`) proving what they can or can't see.

Proof standards: drive the real UI path (no calling `createTrip` or Supabase directly to make the state you then "observe"); `db.mjs` signs in through the same anon key and RLS as the app, so it observes, it doesn't bypass. It refuses to run against a non-local Supabase URL.

## Cleanup

1. Delete the test rows: `node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs cleanup <email-that-created-them> "$PREFIX"` (organiser-only delete via RLS; refuses any prefix that isn't a slot prefix; prints what it removed). Plans, expenses and album rows cascade with the trip, but storage files don't: for a trip with photos, delete it in the app (`Trip settings` → `Delete trip`), which removes the files first.
2. Sign out in the tab (`You` tab → `Sign out`) if you'll hand the tab back.
3. `preview_stop {serverId}` for the `web-verify-N` server you started. Never `pkill node`/`expo`, never stop `:8081` or Supabase unless you started them this run.
4. Evidence stays: confirm `ls .verify-evidence/<run>/` still lists your files.

## Helpers

- `scripts/slot.sh` — prints `SLOT CONFIG PORT PREFIX` for this checkout; use with `eval`.
- `scripts/doctor.sh` — readiness check above.
- `scripts/db.mjs trips <dev-email> [--out file]` — trips visible to that user, with members, as JSON.
- `scripts/db.mjs cleanup <dev-email> <prefix>` — deletes that user's trips whose name starts with `prefix`; only accepts the `verify-<6 hex>-` form from `slot.sh`.

All are executable. `db.mjs` needs `node --env-file=.env.local` from the repo root; `db.mjs` only accepts `@dev.test` emails.
