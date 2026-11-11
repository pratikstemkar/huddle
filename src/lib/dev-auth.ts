/**
 * Developer sign-in: skips Google/Apple while testing.
 *
 * Only active when BOTH hold:
 *  - `__DEV__` is true (never true in a production/release build), and
 *  - `EXPO_PUBLIC_DEV_AUTH=true` is set in `.env.local`.
 *
 * The users below are created by `supabase/seed.sql` in your LOCAL Supabase only.
 * Switching between them lets you test a whole group from one device.
 */
export const devAuthEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH === 'true';

/** Must match the password in supabase/seed.sql. Local test value, not a secret. */
export const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? 'trip-dev-password';

export const DEV_USERS = [
  { name: 'Aarav', email: 'aarav@dev.test', color: '#FF5A36' },
  { name: 'Meera', email: 'meera@dev.test', color: '#0FA3A3' },
  { name: 'Kabir', email: 'kabir@dev.test', color: '#FFC531' },
  { name: 'Zoya', email: 'zoya@dev.test', color: '#8E5BD9' },
] as const;
