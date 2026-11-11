# Huddle — how we work

Huddle is an Expo / React Native group trip planner (Expo Router, Supabase). Read [AGENTS.md](AGENTS.md) first — it holds the Expo rules (check versioned docs, `npx expo install`, lint + typecheck before done, CNG, etc.) and applies in full. This file covers our workflow.

## Project map

- `src/app/` — Expo Router routes only. `src/components/`, `src/lib/`, `src/theme/` hold everything else.
- `supabase/` — migrations, `seed.sql`, config. Local DB: `bun run db:start | db:stop | db:reset`.
- `ROADMAP.md` — MVP feature status. Update it when a feature's status changes.
- `.claude/skills/verify-huddle` — drive the web app against local Supabase to prove a change works.

## Git workflow (most important)

**Application code never goes straight to `main`.** All feature, fix, and refactor work happens on a feature branch.

1. **"Create this feature" (or similar):** do NOT start coding. First write a plan (scope, screens/routes, data/schema changes, files touched, how it will be verified) and get the user's OK.
2. **After the plan is approved:** create a feature branch off an up-to-date `main` (`feat/<short-name>`, `fix/<short-name>`, `refactor/<short-name>`) and implement there. Commit in small, meaningful commits on that branch.
3. **Before calling it done:** run `bun run lint` and `bun run typecheck`, and for user-facing changes verify with the `verify-huddle` skill.
4. **"Push it":** push the branch and open a PR targeting `main` (`gh pr create`). Never push application code to `main` directly, and never merge the PR unless asked.
5. If asked to change app code while on `main`, switch to a feature branch first.

**Allowed directly on `main`** (small, non-app changes): `CLAUDE.md`/`AGENTS.md`, `.claude/` config and skills, `ROADMAP.md`, README/docs. Commit and push these straight to `main` when asked. If a change mixes docs with app code, it goes through a branch + PR.

## Conventions

- Mobile-first, cross-platform (iOS, Android, web); keep performance in mind.
- Use theme tokens from `src/theme` and the base components in `src/components/ui` rather than ad-hoc styles.
- Schema changes go in a new Supabase migration; keep `seed.sql` working for the dev users.
- Use `bun` (a `bun.lock` is present): `bunx` instead of `npx`, `npx expo install <pkg>` semantics for adding dependencies.
- Never commit secrets or `.env` files.
