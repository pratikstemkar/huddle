import { redirectSystemPath } from '@/app/+native-intent';
import { exchangeOAuthCode, isOAuthCallback, oauthCode } from '@/lib/oauth-callback';

import { supabase } from '../../test-utils/supabase-mock';

describe('oauth callback helpers', () => {
  it('recognises the callback link in its different shapes', () => {
    expect(isOAuthCallback('huddle://auth/callback?code=abc')).toBe(true);
    expect(isOAuthCallback('/auth/callback?code=abc')).toBe(true);
    expect(isOAuthCallback('auth/callback')).toBe(true);
    expect(isOAuthCallback('huddle://invite/ABC123')).toBe(false);
    expect(isOAuthCallback('/trip/auth/callbacks')).toBe(false);
  });

  it('reads the code', () => {
    expect(oauthCode('huddle://auth/callback?code=a%2Fb&x=1')).toBe('a/b');
    expect(oauthCode('huddle://auth/callback?error=denied')).toBeNull();
  });

  it('exchanges a code only once while it is in flight', async () => {
    await Promise.all([exchangeOAuthCode('abc'), exchangeOAuthCode('abc')]);
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('rejects with the exchange error and lets a retry through', async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('expired') });
    await expect(exchangeOAuthCode('abc')).rejects.toThrow('expired');
    await exchangeOAuthCode('abc');
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
  });
});

describe('redirectSystemPath', () => {
  it('sends the Google callback home instead of to a missing route, finishing sign-in', () => {
    expect(redirectSystemPath({ path: 'huddle://auth/callback?code=xyz', initial: false })).toBe('/');
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
  });

  it('sends a code-less callback home too', () => {
    expect(redirectSystemPath({ path: 'huddle://auth/callback?error=denied', initial: true })).toBe('/');
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('leaves other links alone', () => {
    expect(redirectSystemPath({ path: 'huddle://invite/ABC123', initial: true })).toBe('huddle://invite/ABC123');
  });
});
