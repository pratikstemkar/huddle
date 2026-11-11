const ENV = { ...process.env };

function load() {
  let mod!: typeof import('@/lib/dev-auth');
  jest.isolateModules(() => {
    mod = require('@/lib/dev-auth');
  });
  return mod;
}

describe('dev-auth', () => {
  afterEach(() => {
    process.env = { ...ENV };
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  });

  it('is on only in dev builds with EXPO_PUBLIC_DEV_AUTH=true', () => {
    process.env.EXPO_PUBLIC_DEV_AUTH = 'true';
    expect(load().devAuthEnabled).toBe(true);
  });

  it('is off when the env flag is missing or not "true"', () => {
    delete process.env.EXPO_PUBLIC_DEV_AUTH;
    expect(load().devAuthEnabled).toBe(false);
    process.env.EXPO_PUBLIC_DEV_AUTH = '1';
    expect(load().devAuthEnabled).toBe(false);
  });

  it('is never on in a release build', () => {
    process.env.EXPO_PUBLIC_DEV_AUTH = 'true';
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    expect(load().devAuthEnabled).toBe(false);
  });

  it('uses the env password, falling back to the seed password', () => {
    delete process.env.EXPO_PUBLIC_DEV_PASSWORD;
    expect(load().DEV_PASSWORD).toBe('trip-dev-password');
    process.env.EXPO_PUBLIC_DEV_PASSWORD = 'other';
    expect(load().DEV_PASSWORD).toBe('other');
  });

  it('lists four dev users with unique dev.test emails', () => {
    const { DEV_USERS } = load();
    expect(DEV_USERS).toHaveLength(4);
    expect(new Set(DEV_USERS.map((u) => u.email)).size).toBe(4);
    for (const u of DEV_USERS) expect(u.email).toMatch(/^[a-z]+@dev\.test$/);
  });
});
