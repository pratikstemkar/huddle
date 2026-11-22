import type { ConfigContext, ExpoConfig } from 'expo/config';

/** The hosted web app. Keep in step with `HOSTED_APP_URL` in src/lib/trips.ts. */
const HOSTED_APP_URL = 'https://huddletrips.vercel.app';

/**
 * Extends app.json. Invite links on the hosted web app's domain (`https://<domain>/invite/<code>` and
 * `/group-invite/<code>`) open the installed app: iOS universal links + Android app links. The domain is
 * EXPO_PUBLIC_APP_URL, else the hosted app, and must serve public/.well-known/{apple-app-site-association,assetlinks.json}.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const host = new URL(process.env.EXPO_PUBLIC_APP_URL || HOSTED_APP_URL).host;

  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, associatedDomains: [`applinks:${host}`] },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host, pathPrefix: '/invite/' },
            { scheme: 'https', host, pathPrefix: '/group-invite/' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
