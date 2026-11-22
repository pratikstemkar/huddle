import { useEffect, useState } from 'react';

import { RELEASES_URL } from './notifications';

/** The latest release's page: where the APK lives when its own link can't be looked up. */
export const LATEST_RELEASE_URL = `${RELEASES_URL}latest`;
const LATEST_RELEASE_API = 'https://api.github.com/repos/pratikstemkar/huddle/releases/latest';

/** The direct download link of the latest release's APK, or the release page when it can't be found. */
export async function latestApkUrl(): Promise<string> {
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return LATEST_RELEASE_URL;
    const release = (await res.json()) as { assets?: { name?: string; browser_download_url?: string }[] };
    const apk = release.assets?.find((a) => a.name?.endsWith('.apk') && a.browser_download_url?.startsWith('https://github.com/'));
    return apk?.browser_download_url ?? LATEST_RELEASE_URL;
  } catch {
    return LATEST_RELEASE_URL;
  }
}

/**
 * The APK link, looked up ahead of the tap so the download starts from the tap itself (a link opened
 * after an await can be blocked as a popup). The release page until the lookup lands.
 */
export function useLatestApkUrl() {
  const [url, setUrl] = useState(LATEST_RELEASE_URL);
  useEffect(() => {
    let live = true;
    latestApkUrl().then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, []);
  return url;
}

export type VisitorPlatform = 'android' | 'ios' | 'desktop';

/** Which phone the web visitor is on, from the browser. iPads asking for the desktop site report a Mac with touch. */
export function visitorPlatform(userAgent: string, maxTouchPoints = 0): VisitorPlatform {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function currentVisitorPlatform(): VisitorPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  return visitorPlatform(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0);
}
