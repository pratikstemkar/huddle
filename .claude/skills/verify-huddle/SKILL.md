---
name: verify-huddle
description: Drive the Huddle Expo app on web (Expo Router + local Supabase) the way a user does and prove a change works — sign in as a seeded dev user, click through trip screens in the built-in browser, and check the resulting Supabase rows. Use before declaring any user-facing Huddle change done.
---

# Verify Huddle

Primary surface: the Expo app rendered on **web** (`react-native-web`), driven with the built-in browser (`mcp__Claude_Browser__*`). Backend: **local Supabase** (Docker) on `127.0.0.1:54321`, with RLS on every table. iOS/Android are not covered here; a native-only change (haptics, Apple sign-in, `formSheet` detents) needs a dev build and stays unverified by this skill — say so.

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
| `/` (home) | `New trip` | button |
| `/` | `Join with a code` | button |
| `/` | `Your profile` | button (the avatar, top right) |
| `/profile` | `Your name` | textbox (max 40 chars) |
| `/profile` | `Sunset` … `Sky` | radio (avatar colour) |
| `/profile` | `Save profile` / `Sign out` | button |
| `/` | `<trip name>, still planning` / `<trip name>, locked in` | button per trip card |
| `/new-trip` | `Trip name` | textbox (max 60 chars) |
| `/new-trip` | `Sunset` `Lagoon` `Mango` `Plum` `Bougainvillea` `Sky` | radio |
| `/new-trip` | `Create trip` | button |
| `/join` | `Invite code` | textbox |
| `/join` | `Join trip` | button |
| `/trip/[id]` | `Back to your trips` | button |
| `/trip/[id]` | `Copy code` / `Share invite` | button |
| `/trip/[id]` | `Mark my days` | button |
| `/trip/[id]/days` | `My days` / `Everyone` | tab |
| `/trip/[id]/days` | `<Weekday>, <Month> <day>` | button per day |

Batch predictable steps with `browser_batch` (click → wait 1–2s → `get_page_text`). The URL in each result's tab context confirms navigation (`/sign-in` → `/` → `/new-trip` → `/`).

Seeded data (`supabase/seed.sql`): users Aarav (`1111…`), Meera (`2222…`), Kabir, Zoya, all with password `trip-dev-password`. Trip "Goa in March" (invite `goa2027`): Aarav organiser, Meera member; Kabir and Zoya are in no trips. Trip "Pondy long weekend" (invite `pondy27`) is already locked: Aarav organiser, Meera member. The user's local DB may hold extra trips they made — never delete those.

**Test data rule:** start every trip name you create with this checkout's `PREFIX` (e.g. `verify-cd9004-lagoon`) so only your cleanup finds it, and never edit or delete anything else. Other worktrees' `verify-…` rows may be in the list mid-run; ignore them.

## Evidence

Put each run's proof in `.verify-evidence/<YYYYMMDD-HHMMSS>-<feature>/` (git-ignored). A complete proof has:

1. `before.json` — DB state before the action:
   `node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs trips <email> --out <run>/before.json`
2. The UI path: the `get_page_text` after each step, and a `screenshot` of the end state. Screenshot images are saved under the session's `tool-results/` folder (the path is printed with the image); `cp` the final one into the run folder.
3. `after.json` — the same `db.mjs trips` call afterwards. Assert the side effect (row exists, right `color`, the `trip_members` role), not only what's on screen.
4. For anything shared between users, an RLS check as a second user (`db.mjs trips meera@dev.test --out <run>/rls-meera.json`) proving what they can or can't see.

Proof standards: drive the real UI path (no calling `createTrip` or Supabase directly to make the state you then "observe"); `db.mjs` signs in through the same anon key and RLS as the app, so it observes, it doesn't bypass. It refuses to run against a non-local Supabase URL.

## Cleanup

1. Delete the test rows: `node --env-file=.env.local .claude/skills/verify-huddle/scripts/db.mjs cleanup <email-that-created-them> "$PREFIX"` (organiser-only delete via RLS; refuses any prefix that isn't a slot prefix; prints what it removed).
2. Sign out in the tab (`Your profile` → `Sign out`) if you'll hand the tab back.
3. `preview_stop {serverId}` for the `web-verify-N` server you started. Never `pkill node`/`expo`, never stop `:8081` or Supabase unless you started them this run.
4. Evidence stays: confirm `ls .verify-evidence/<run>/` still lists your files.

## Helpers

- `scripts/slot.sh` — prints `SLOT CONFIG PORT PREFIX` for this checkout; use with `eval`.
- `scripts/doctor.sh` — readiness check above.
- `scripts/db.mjs trips <dev-email> [--out file]` — trips visible to that user, with members, as JSON.
- `scripts/db.mjs cleanup <dev-email> <prefix>` — deletes that user's trips whose name starts with `prefix`; only accepts the `verify-<6 hex>-` form from `slot.sh`.

All are executable. `db.mjs` needs `node --env-file=.env.local` from the repo root; `db.mjs` only accepts `@dev.test` emails.
