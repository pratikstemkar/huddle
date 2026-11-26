import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const projectToken = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined;
const host = Constants.expoConfig?.extra?.posthogHost as string | undefined;
const isConfigured = Boolean(projectToken && host);

if (!isConfigured && __DEV__) {
  if (!projectToken) {
    console.error(
      new Error(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
      ),
    );
  }

  if (!host) {
    console.error(
      new Error(
        'POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured',
      ),
    );
  }
}

export const posthog = isConfigured
  ? new PostHog(projectToken!, {
      host,
      logs: {
        serviceName: 'huddle-mobile',
        serviceVersion: Constants.expoConfig?.version,
        environment: __DEV__ ? 'development' : 'production',
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
        },
      },
    })
  : undefined;
