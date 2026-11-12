import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. When EXPO_PUBLIC_APP_URL (the hosted web app) is set, invite links on that domain
 * (`https://<domain>/invite/<code>`) open the installed app: iOS universal links + Android app links.
 * The domain must also serve public/.well-known/{apple-app-site-association,assetlinks.json}.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL;
  if (!appUrl) return config as ExpoConfig;
  const host = new URL(appUrl).host;

  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, associatedDomains: [`applinks:${host}`] },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host, pathPrefix: '/invite' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
