import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase, unsubscribeAuth } from '../../test-utils/supabase-mock';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'huddle://auth/callback') }));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('@/lib/dev-auth', () => ({ devAuthEnabled: true, DEV_PASSWORD: 'test-password' }));

// Imported after the mocks above are registered.
const { AuthProvider, displayName, useAuth } = require('@/lib/auth') as typeof import('@/lib/auth');

const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const appleSignIn = AppleAuthentication.signInAsync as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const session = (user: Partial<Session['user']>) => ({ user: { user_metadata: {}, ...user } }) as unknown as Session;

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

async function renderAuth() {
  const hook = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('displayName', () => {
  it('prefers full_name, then name, then the email prefix', () => {
    expect(displayName(session({ user_metadata: { full_name: 'Aarav S', name: 'A' }, email: 'a@x.com' }))).toBe('Aarav S');
    expect(displayName(session({ user_metadata: { name: 'Meera' }, email: 'm@x.com' }))).toBe('Meera');
    expect(displayName(session({ email: 'kabir@dev.test' }))).toBe('kabir');
  });

  it('falls back to Traveller', () => {
    expect(displayName(null)).toBe('Traveller');
    expect(displayName(session({}))).toBe('Traveller');
  });
});

describe('useAuth', () => {
  it('throws outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth must be used inside <AuthProvider>');
    (console.error as jest.Mock).mockRestore();
  });
});

describe('AuthProvider', () => {
  it('loads the stored session on launch', async () => {
    const s = session({ id: 'u1' });
    supabase.auth.getSession.mockResolvedValue({ data: { session: s } });
    const { result } = await renderAuth();
    expect(result.current.session).toBe(s);
  });

  it('follows sign-in and sign-out events, and unsubscribes on unmount', async () => {
    const { result, unmount } = await renderAuth();
    const listener = supabase.auth.onAuthStateChange.mock.calls[0][0];
    const s = session({ id: 'u2' });
    await act(async () => listener('SIGNED_IN', s));
    expect(result.current.session).toBe(s);
    await act(async () => listener('SIGNED_OUT', null));
    expect(result.current.session).toBeNull();
    await unmount();
    expect(unsubscribeAuth).toHaveBeenCalled();
  });

  it('signs out', async () => {
    const { result } = await renderAuth();
    await act(() => result.current.signOut());
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  describe('developer sign-in', () => {
    it('signs in with the shared dev password', async () => {
      const { result } = await renderAuth();
      await act(() => result.current.signInAsDevUser('aarav@dev.test'));
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'aarav@dev.test', password: 'test-password' });
    });

    it('throws the auth error', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({ error: new Error('bad creds') });
      const { result } = await renderAuth();
      await expect(result.current.signInAsDevUser('x@dev.test')).rejects.toThrow('bad creds');
    });
  });

  describe('Google', () => {
    beforeAll(() => {
      // The native test environment has no page URL; web sign-in redirects back to it.
      Object.defineProperty(window, 'location', { value: { origin: 'http://localhost:8081' }, configurable: true });
    });

    it('redirects the page on web', async () => {
      const { result } = await renderAuth();
      await withOS('web', () => result.current.signInWithGoogle());
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://localhost:8081' } });
      expect(openAuthSession).not.toHaveBeenCalled();
    });

    it('throws the error on web', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ error: new Error('oauth off') });
      const { result } = await renderAuth();
      await expect(withOS('web', () => result.current.signInWithGoogle())).rejects.toThrow('oauth off');
    });

    it('opens an auth session on native and exchanges the code', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://auth.example/authorize' }, error: null });
      openAuthSession.mockResolvedValue({ type: 'success', url: 'huddle://auth/callback?code=abc' });
      const { result } = await renderAuth();
      await result.current.signInWithGoogle();
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: 'huddle://auth/callback', skipBrowserRedirect: true },
      });
      expect(openAuthSession).toHaveBeenCalledWith('https://auth.example/authorize', 'huddle://auth/callback');
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    });

    it('does nothing when the user cancels', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'u' }, error: null });
      openAuthSession.mockResolvedValue({ type: 'cancel' });
      const { result } = await renderAuth();
      await expect(result.current.signInWithGoogle()).resolves.toBeUndefined();
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('throws when no code comes back', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'u' }, error: null });
      openAuthSession.mockResolvedValue({ type: 'success', url: 'huddle://auth/callback?error=denied' });
      const { result } = await renderAuth();
      await expect(result.current.signInWithGoogle()).rejects.toThrow("Google didn't return a sign-in code. Try again.");
    });

    it('throws when starting OAuth fails on native', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error('oauth off') });
      const { result } = await renderAuth();
      await expect(result.current.signInWithGoogle()).rejects.toThrow('oauth off');
    });

    it('throws when exchanging the code fails', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'u' }, error: null });
      openAuthSession.mockResolvedValue({ type: 'success', url: 'huddle://auth/callback?code=abc' });
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });
      const { result } = await renderAuth();
      await expect(result.current.signInWithGoogle()).rejects.toThrow('expired');
    });
  });

  describe('Apple', () => {
    it('is only offered on iOS', async () => {
      const { result } = await renderAuth();
      await expect(withOS('android', () => result.current.signInWithApple())).rejects.toThrow('Sign in with Apple is only available on iPhone.');
    });

    it('signs in with the identity token and saves the name', async () => {
      appleSignIn.mockResolvedValue({ identityToken: 'tok', fullName: { givenName: 'Zoya', familyName: 'K' } });
      const { result } = await renderAuth();
      await withOS('ios', () => result.current.signInWithApple());
      expect(appleSignIn).toHaveBeenCalledWith({ requestedScopes: [0, 1] });
      expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'tok' });
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Zoya K' } });
    });

    it("doesn't overwrite the name when Apple doesn't share it", async () => {
      appleSignIn.mockResolvedValue({ identityToken: 'tok', fullName: null });
      const { result } = await renderAuth();
      await withOS('ios', () => result.current.signInWithApple());
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('throws without a token', async () => {
      appleSignIn.mockResolvedValue({ identityToken: null });
      const { result } = await renderAuth();
      await expect(withOS('ios', () => result.current.signInWithApple())).rejects.toThrow("Apple didn't return a token. Try again.");
    });

    it('throws the Supabase error', async () => {
      appleSignIn.mockResolvedValue({ identityToken: 'tok' });
      supabase.auth.signInWithIdToken.mockResolvedValue({ error: new Error('invalid token') });
      const { result } = await renderAuth();
      await expect(withOS('ios', () => result.current.signInWithApple())).rejects.toThrow('invalid token');
    });

    it('treats cancelling as a no-op', async () => {
      appleSignIn.mockRejectedValue(Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' }));
      const { result } = await renderAuth();
      await expect(withOS('ios', () => result.current.signInWithApple())).resolves.toBeUndefined();
    });
  });
});
