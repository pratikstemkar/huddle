import { AppState, Platform } from 'react-native';

// Every other test replaces this module with a fake; here we check the real client setup.
jest.unmock('@/lib/supabase');
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } })) }));

const ENV = { ...process.env };

function load(os: string, env: Record<string, string | undefined>) {
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  let mod!: typeof import('@/lib/supabase');
  let createClient!: jest.Mock;
  jest.isolateModules(() => {
    // The isolated registry has its own react-native, so set the platform on that copy.
    const platform: typeof Platform = require('react-native').Platform;
    const prev = platform.OS;
    Object.defineProperty(platform, 'OS', { value: os, configurable: true });
    try {
      createClient = require('@supabase/supabase-js').createClient;
      mod = require('@/lib/supabase');
    } finally {
      Object.defineProperty(platform, 'OS', { value: prev, configurable: true });
    }
  });
  return { mod, createClient };
}

describe('supabase client', () => {
  let listener: ((s: string) => void) | undefined;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    listener = undefined;
    spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
      listener = cb as (s: string) => void;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    spy.mockRestore();
    process.env = { ...ENV };
  });

  it('uses the project URL and key from the environment', () => {
    const { mod, createClient } = load('ios', { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon' });
    expect(mod.isSupabaseConfigured).toBe(true);
    const [url, key, options] = createClient.mock.calls[0];
    expect(url).toBe('https://example.supabase.co');
    expect(key).toBe('anon');
    expect(options.auth).toMatchObject({ autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' });
    expect(options.auth.storage).toBeDefined();
  });

  it('reports when it is not configured, without crashing', () => {
    const { mod, createClient } = load('ios', { EXPO_PUBLIC_SUPABASE_URL: undefined, EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined });
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(createClient).toHaveBeenCalled();
  });

  it('refreshes tokens only while the app is in the foreground on native', () => {
    const { mod } = load('ios', { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' });
    listener!('active');
    expect(mod.supabase.auth.startAutoRefresh).toHaveBeenCalled();
    listener!('background');
    expect(mod.supabase.auth.stopAutoRefresh).toHaveBeenCalled();
  });

  it('uses browser storage and reads the session from the URL on web', () => {
    const { createClient } = load('web', { EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' });
    const options = createClient.mock.calls[0][2];
    expect(options.auth.storage).toBeUndefined();
    expect(options.auth.detectSessionInUrl).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
