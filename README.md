# Huddle

Huddle is where a group picks dates, votes on places, and locks in a trip together. Expo (SDK 58) app for iOS, Android and mobile web, backed by Supabase.

What's built and what's next: [ROADMAP.md](ROADMAP.md).

## Run it locally

1. Give your user Docker access (one time, then log out and back in):
   ```bash
   sudo usermod -aG docker $USER
   ```
2. Start local Supabase (applies `supabase/migrations` and `supabase/seed.sql`):
   ```bash
   npm run db:start
   ```
   Without Docker group access, use `sudo env "PATH=$PATH" npx supabase start` instead. Metro is set to ignore `supabase/`, so the root-owned files that sudo leaves there don't break the app.
3. Copy the env file and paste the **anon key** printed by step 2:
   ```bash
   cp .env.example .env.local
   ```
4. Start the app:
   ```bash
   npm run web
   ```

## Signing in while testing

With `EXPO_PUBLIC_DEV_AUTH=true` the sign-in screen shows **Developer sign-in** chips (Aarav, Meera, Kabir, Zoya). They are seeded users in your local Supabase only. Switch between them to test a group from one device. This path is compiled out of production builds (`__DEV__` is false there).

## Real sign-in

- **Google**: all platforms, through Supabase OAuth. Works in the browser and in Expo Go via an in-app browser redirect.
- **Apple**: iPhone only, required for the App Store when Google is offered. Needs a development build (`npx expo run:ios` or `eas build --profile development`).

Enable both in your hosted Supabase project under Authentication → Providers, and add these redirect URLs: your web URL, `huddle://auth/callback`.

## Layout

- `src/app` routes: `sign-in`, `(app)/index` (home), `(app)/new-trip` (sheet)
- `src/theme` Sunset club tokens (light and dark), `useTheme`, `useReducedMotion`
- `src/components/ui` Text, Button, Card, Screen
- `src/lib` Supabase client, auth (Google, Apple, dev), trips
- `supabase/` schema with row-level security, seed users

## Checks

```bash
npm run typecheck
```

```bash
npx expo lint
```
