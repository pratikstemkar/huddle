This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

This project uses **bun** — never use npm/npx/yarn/pnpm. Use `bun` / `bunx`.

```bash
bunx expo install <package> # ALWAYS use instead of bun add — resolves SDK-compatible versions
bunx expo start              # start the dev server
bun run lint                      # lint
bun run typecheck             # typecheck
bun run test                  # unit tests (Jest + jest-expo); CI runs these on every push and PR
bunx expo-doctor             # diagnose dependency and config issues
bunx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck and tests before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>`; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `bunx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Project map

- `src/app/` — Expo Router routes only. `src/components/`, `src/lib/`, `src/theme/` hold everything else.
- `supabase/` — migrations, `seed.sql`, config. Local DB: `bun run db:start | db:stop | db:reset`.
- `__tests__/` — Jest tests, mirroring `src/` (never inside `src/app/`). `test-utils/` holds the fake Supabase client, the `expo-router` mock and fixtures; `jest.setup.ts` wires them in so no test touches a real database.
- `ROADMAP.md` — MVP feature status. Update it when a feature's status changes.
- `.claude/skills/verify-huddle` — drive the web app against local Supabase to prove a change works.

## Local testing alongside other checkouts

This machine often has several git worktrees of this repo, each with its own agent or person testing at once. Never stop, kill, reset or drive someone else's server. `git worktree list` shows the other checkouts.

**Expo web port.** Never take `:8081` (the user's own Expo). Pick this checkout's slot with `eval "$(.claude/skills/verify-huddle/scripts/slot.sh)"` and start `preview_start {name: "$CONFIG"}` (ports 8091–8096, defined in `.claude/launch.json`). `slot.sh` skips any port another checkout already holds.

**When a port is already in use:**

1. See who holds it: `ss -ltnp | grep :<port>`, then `readlink /proc/<pid>/cwd` to find out which checkout it belongs to. Docker ports (Supabase) show no pid here; use `docker ps --format '{{.Names}} {{.Ports}}'` instead (container names end in the `project_id`).
2. If it's this checkout's own server from an earlier run, reuse it, or stop it with `preview_stop`.
3. If it belongs to another checkout or the user, leave it alone and take a different port: re-run `slot.sh` for Expo, or use an isolated Supabase (below). For a one-off command, pass another port (`bunx expo start --web --port <free port>`).
4. If all six Expo slots are taken, say so and ask the user. Don't free one up yourself.

**Supabase: shared or isolated.** One local Supabase (project `group-trip-planner`, API `:54321`, DB `:54322`, Studio `:54323`, Inbucket `:54324`, analytics `:54327`) is shared by every checkout. It's fine to use when your branch adds **no** migrations and only touches rows named with your `PREFIX`. Run your own stack on different ports instead when your branch adds a migration (applying it to the shared DB changes it for everyone), when you need `db:reset`, or when a test deletes users or other shared seed data. To do that:

```bash
eval "$(.claude/skills/verify-huddle/scripts/slot.sh)"
WD=".supabase-isolated/slot-$SLOT"; mkdir -p "$WD/supabase"
# Fresh project_id, and every 543xx port moved up by 1000 x slot (slot 2 -> API on :56321).
perl -pe 's/^project_id = .*/project_id = "huddle-slot-$ENV{SLOT}"/; s/= 543(\d\d)\b/"= ".(54300+$1+1000*$ENV{SLOT})/e; s/^inspector_port = 8083/"inspector_port = ".(8083+100*$ENV{SLOT})/e' supabase/config.toml > "$WD/supabase/config.toml"
ln -sfn "$PWD/supabase/migrations" "$WD/supabase/migrations"; ln -sf "$PWD/supabase/seed.sql" "$WD/supabase/seed.sql"
[ -d supabase/functions ] && ln -sfn "$PWD/supabase/functions" "$WD/supabase/functions"
SLOT=$SLOT bunx supabase start --workdir "$WD"     # db reset/stop/status take the same --workdir
```

Then point **this checkout's** `.env.local` at it: set `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:<its API port>` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the publishable key from `bunx supabase status --workdir "$WD"`, and restart Expo. `.env.local` is git-ignored and separate in each worktree, so this doesn't affect anyone else. When you're done, run `bunx supabase stop --workdir "$WD"` and point `.env.local` back at `:54321`. Supabase talks to Docker, so in a sandboxed shell it needs to run outside the sandbox, or ask the user to run it.

## Git workflow (most important)

**Application code never goes straight to `main`.** All feature, fix, and refactor work happens on a feature branch.

1. **"Create this feature" (or similar):** do NOT start coding. First write a plan (scope, screens/routes, data/schema changes, files touched, how it will be verified) and get the user's OK.
2. **After the plan is approved:** create a feature branch off an up-to-date `main` (`feat/<short-name>`, `fix/<short-name>`, `refactor/<short-name>`) and implement there. Commit in small, meaningful commits on that branch.
3. **Before calling it done:** run `bun run lint`, `bun run typecheck` and `bun run test`, and for user-facing changes verify with the `verify-huddle` skill.
4. **"Push it":** push the branch and open a PR targeting `main` (`gh pr create`). Never push application code to `main` directly, and never merge the PR unless asked.
5. If asked to change app code while on `main`, switch to a feature branch first.

**Allowed directly on `main`** (small, non-app changes): `AGENTS.md`, `.claude/` config and skills, `ROADMAP.md`, README/docs. Commit and push these straight to `main` when asked. If a change mixes docs with app code, it goes through a branch + PR.

## Releasing

Tag `vX.Y.Z` to ship: `.github/workflows/android.yml` builds the APK on GitHub, `update.yml` publishes OTA, `rollback.yml` retracts. `bun run release:set <version|major|minor|patch>` bumps `package.json` + `app.json` and regenerates `CHANGELOG.md`; `bun run release:check` verifies they agree (CI runs it). Use conventional commit subjects (`feat:`, `fix:`, ...) — the changelog is built from them. Pin new GitHub Actions to a commit SHA with the version in a trailing comment. Details in CONTRIBUTING.md.

## Conventions

- Mobile-first, cross-platform (iOS, Android, web); keep performance in mind.
- Use theme tokens from `src/theme` and the base components in `src/components/ui` rather than ad-hoc styles.
- Schema changes go in a new Supabase migration; keep `seed.sql` working for the dev users.
- Never commit secrets or `.env` files.
