import { posthog } from '@/config/posthog';

type LogAttributes = Record<string, boolean | number | string>;

/** Sends only purpose-written product-operation logs to PostHog. */
export const posthogLogger = {
  info: (message: string, attributes: LogAttributes) => {
    posthog?.logger.info(message, attributes);
  },
};
