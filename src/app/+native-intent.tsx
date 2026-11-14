import { exchangeOAuthCode, isOAuthCallback, oauthCode } from '@/lib/oauth-callback';

/**
 * The Google sign-in redirect (huddle://auth/callback?code=…) is meant for the auth session, not
 * for a screen. Send the router home instead of to a missing route; the auth guard in the root
 * layout then shows the right screen once the session lands.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (!isOAuthCallback(path)) return path;
    // If Android restarted the app while the browser was open, nobody else is waiting for this
    // code, so finish signing in here. Otherwise this shares the in-flight exchange.
    const code = oauthCode(path);
    if (code) exchangeOAuthCode(code).catch(() => {});
    return '/';
  } catch {
    return '/';
  }
}
