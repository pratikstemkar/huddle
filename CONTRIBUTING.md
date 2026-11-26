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

- `src/app` Expo Router routes only: `sign-in`, `invite/[code]`, `privacy`, the home tabs `(app)/(home)/` (`index` Trips, `groups` Groups, `profile` You), `(app)/new-trip`, `(app)/new-group`, `(app)/join`, `(app)/group/[id]/` (`index`, `edit`, `add`), `(app)/delete-account`, `group-invite/[code]`, and `(app)/trip/[id]/`: the tabs `(tabs)/` (`index` Trip, `vote`, `plan`, `split`, `photos`) plus the sheets and pages `invite`, `invite-people`, `suggest`, `lock`, `locked`, `settings`, `plan-item`, `expense`, `settle`, `photo/[photoId]` (`days` and `places` only redirect to `vote`)
- `src/theme` Huddle design tokens (light and dark, five trip colours), `useTheme`, `useReducedMotion`
- `src/components` UI building blocks; base components in `src/components/ui`, Pip in `src/components/pip`, the tab bars in `src/components/nav`
- `src/lib` Supabase client, auth (Google, Apple, dev), trips, availability, realtime, itinerary, split and money, trip photos, calendar, trip status and stats
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

## Push notifications

Notifications are rows in `notifications`, written by database triggers. The `send-push` edge function (`supabase/functions/send-push`) sends them through Expo's push service. Nothing is pushed until these are set up. The in-app Activity list works without them.

1. **Android (FCM v1).**
   - Create a Firebase project and add an Android app with package `com.huddle.app`.
   - Put `google-services.json` in the repo root and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
   - In Firebase, go to Project settings → Service accounts → Generate new private key. Upload that key with `bunx eas-cli credentials` (Android → production → Google Service Account → FCM V1). Never commit the key.
2. **iOS (APNs).** This needs a paid Apple Developer account. Say yes to the push key when `bunx eas-cli build` asks.
3. **Hosted Supabase.**
   - Deploy the function: `bunx supabase functions deploy send-push --no-verify-jwt`.
   - If enhanced push security is on in Expo, set `EXPO_ACCESS_TOKEN` on it: `bunx supabase secrets set EXPO_ACCESS_TOKEN=<token>`.
   - Store the function URL and a long random secret in Vault (SQL editor). The database sends that secret with each call and the function checks it against Vault, so it lives only there:

     ```sql
     select vault.create_secret('https://<project>.supabase.co/functions/v1/send-push', 'push_function_url');
     select vault.create_secret('<long random string>', 'push_function_secret');
     ```

     The migration has already enabled `pg_net` and `pg_cron`, and schedules a retry and receipt check every five minutes.
4. **A new native build.** `expo-notifications` is a native module, so an OTA update can't add it. Push also never works in Expo Go on Android.

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

- `android.yml` builds the APK (arm64 by default), verifies the embedded update fingerprint, checks the size against `scripts/perf/apk-baseline.json` and publishes the release. Also runs by hand from the Actions tab. On a tag, its `announce` job then notifies everyone (see below).
- `update.yml` publishes the bundle to EAS Update on the `production` branch.
- `rollback.yml` retracts a bad update. Run it from the same tag the live APK was built from.

Repository settings: variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL` (the hosted web app, `https://huddletrips.vercel.app`; release builds fall back to it when empty), `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` (analytics and error reports; off when either is empty), and secrets `EXPO_TOKEN` and `RELEASE_ANNOUNCE_SECRET`. An update only reaches an APK with the same runtime version (a fingerprint of the native app), so adding a native module or changing a plugin needs a new APK, not an update. The two PostHog variables are part of that fingerprint too: after changing one, release a new APK. After a first good build, record its size with `node scripts/perf/apk-size.mjs <apk> --update` and commit the baseline.

### Release notifications

After the release is published and that commit's OTA Update run has succeeded, the `announce` job calls `announce_release()` in the database. Everyone with Huddle on an Android phone gets a push and an Activity item (unless they turned off **App updates** on the You tab). The message depends on each person's newest phone:

- **Same runtime version as the release:** the OTA reaches it. "Huddle X.Y.Z is ready. Close Huddle and open it again to get the update." Tapping it opens the app.
- **Different or unknown runtime version:** that phone needs the new APK. "Huddle X.Y.Z needs a new download." Tapping it opens the GitHub release page.

Phones report their runtime version when they register for push. Ones registered by an app from before this feature have none, so they get the APK message until they open an update that has it.

Setup, once. Pick a long random string, then:

1. Add it as the repository secret `RELEASE_ANNOUNCE_SECRET`.
2. Store the same value in Vault on the hosted project (SQL editor):

   ```sql
   select vault.create_secret('<the same string>', 'release_announce_secret');
   ```

Without the secret, the job warns and skips. A version is announced once (`releases` table), so re-running the job is safe. If the OTA run failed, the job fails rather than tell people to restart for an update that isn't there. Fix it, then re-run the job.
