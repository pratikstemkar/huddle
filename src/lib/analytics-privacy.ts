// Keeps join credentials out of analytics: an invite code lets anyone holding it join.
import type { PostHogOptions } from 'posthog-react-native';

type BeforeSend = Exclude<NonNullable<PostHogOptions['before_send']>, unknown[]>;
type CaptureEvent = Parameters<BeforeSend>[0];

/** `/invite/<code>`, `/group-invite/<code>` and `?code=` (invite and sign-in links). `[code]` is a route name, not a code. */
const SECRETS = /(invite\/(?!\[)|[?&#]code=)[^/?&#\s"'\\]+/g;

export function redactCodes(text: string) {
  return text.replace(SECRETS, '$1[redacted]');
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') return redactCodes(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry)]));
  }
  return value;
}

/** PostHog `before_send`: the SDK attaches links on its own (the URL that opened the app, error messages). */
export function redactEvent(event: CaptureEvent) {
  return redact(event) as CaptureEvent;
}

/** The route pattern, such as `/trip/[id]/vote`, so ids and codes never name a screen. */
export function screenName(segments: string[]) {
  return `/${segments.filter((segment) => !segment.startsWith('(')).join('/')}`;
}
