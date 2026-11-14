import { supabase } from './supabase';

/** Where Google sends the user back to on native: huddle://auth/callback?code=… */
export const OAUTH_CALLBACK_PATH = 'auth/callback';

export function isOAuthCallback(url: string) {
  return /(^|[/:])auth\/callback(?=$|[/?#])/.test(url);
}

export function oauthCode(url: string) {
  const match = /[?&]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

// On Android the callback link reaches the app twice: once through openAuthSessionAsync and once
// as a deep link to the router. A PKCE code can only be exchanged once, so share the attempt.
const inFlight = new Map<string, Promise<void>>();

export function exchangeOAuthCode(code: string) {
  let attempt = inFlight.get(code);
  if (!attempt) {
    attempt = supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) throw error;
      })
      .finally(() => inFlight.delete(code));
    inFlight.set(code, attempt);
  }
  return attempt;
}
