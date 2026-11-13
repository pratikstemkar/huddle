# Contributing to Huddle

Huddle is an Expo (SDK 58) app for iOS, Android and mobile web, backed by Supabase. This page is for developers; the [README](README.md) is the user-facing introduction.

What's built and what's next: [ROADMAP.md](ROADMAP.md). Project conventions and the git workflow: [AGENTS.md](AGENTS.md).

## Run it locally

This project uses **bun**.

1. Give your user Docker access (one time, then log out and back in):
   ```bash
   sudo usermod -aG docker $USER
   ```
2. Start local Supabase (applies `supabase/migrations` and `supabase/seed.sql`):
   ```bash
   bun run db:start
   ```
   Without Docker group access, use `sudo env "PATH=$PATH" bunx supabase start` instead. Metro is set to ignore `supabase/`, so the root-owned files that sudo leaves there don't break the app.
3. Copy the env file and paste the **anon key** printed by step 2:
   ```bash
   cp .env.example .env.local
   ```
4. Start the app:
   ```bash
   bun run web
   ```

## Signing in while testing

With `EXPO_PUBLIC_DEV_AUTH=true` the sign-in screen shows **Developer sign-in** chips (Aarav, Meera, Kabir, Zoya). They are seeded users in your local Supabase only. Switch between them to test a group from one device. This path is compiled out of production builds (`__DEV__` is false there).

## Real sign-in

- **Google**: all platforms, through Supabase OAuth. Works in the browser and in Expo Go via an in-app browser redirect.
- **Apple**: iPhone only, required for the App Store when Google is offered. Needs a development build (`bunx expo run:ios` or `eas build --profile development`).

Enable both in your hosted Supabase project under Authentication → Providers, and add these redirect URLs: your web URL, `huddle://auth/callback`.

## Layout

- `src/app` Expo Router routes only: `sign-in`, `(app)/index` (home), `(app)/new-trip`, `(app)/join`, `(app)/trip/[id]/…` (detail, days, places, suggest, lock, settings)
- `src/theme` Sunset club tokens (light and dark), `useTheme`, `useReducedMotion`
- `src/components` UI building blocks; base components in `src/components/ui`
- `src/lib` Supabase client, auth (Google, Apple, dev), trips, availability, realtime
- `supabase/` schema with row-level security, seed users
- `__tests__/` Jest tests mirroring `src/`; `test-utils/` holds the fake Supabase client and fixtures

## Checks

Run these before opening a pull request (CI runs them on every push and PR):

```bash
bun run lint
```

```bash
bun run typecheck
```

```bash
bun run test
```

## Releasing

Pushing a `vX.Y.Z` tag builds the Android APK on GitHub (no EAS build credits), attaches it to a GitHub Release with notes from `CHANGELOG.md`, and publishes the JavaScript to installed apps over the air. Commits use conventional prefixes (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`...) because the changelog is built from them.

```bash
bun run release:set minor
```

That sets the version in `package.json` and `app.json` (or pass an exact version) and regenerates `CHANGELOG.md`. Read the diff, then:

```bash
git commit -am "Cut version 1.1.0"
```

```bash
git tag v1.1.0 && git push && git push --tags
```

The release runs on a tag, so the commit must be on `main` first. Workflows:

- `android.yml` builds the APK (arm64 by default), verifies the embedded update fingerprint, checks the size against `scripts/perf/apk-baseline.json` and publishes the release. Also runs by hand from the Actions tab.
- `update.yml` publishes the bundle to EAS Update on the `production` branch.
- `rollback.yml` retracts a bad update. Run it from the same tag the live APK was built from.

Repository settings: variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, and secret `EXPO_TOKEN`. An update only reaches an APK with the same runtime version (a fingerprint of the native app), so adding a native module or changing a plugin needs a new APK, not an update. After a first good build, record its size with `node scripts/perf/apk-size.mjs <apk> --update` and commit the baseline.
