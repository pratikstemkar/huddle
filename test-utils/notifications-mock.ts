/**
 * Fakes for expo-notifications and expo-device. Tests run as a real phone (`isDevice`), with permission
 * already granted unless `notificationState.permission` says otherwise. Set `lastResponse` to act as a
 * tapped notification, `token` for the push token Expo hands back.
 */

type Permission = 'granted' | 'denied' | 'undetermined';

export const notificationState = {
  permission: 'granted' as Permission,
  /** False once a `denied` is final (iOS after one no, Android after two). */
  canAskAgain: false,
  /** What the system prompt answers. */
  promptAnswer: 'granted' as Permission,
  token: 'ExponentPushToken[test-token]',
  tokenError: null as Error | null,
  lastResponse: null as unknown,
  badge: 0,
};

export function resetNotificationMocks() {
  notificationState.permission = 'granted';
  notificationState.promptAnswer = 'granted';
  notificationState.canAskAgain = false;
  notificationState.token = 'ExponentPushToken[test-token]';
  notificationState.tokenError = null;
  notificationState.lastResponse = null;
  notificationState.badge = 0;
}

/** A notification tap as `useLastNotificationResponse` reports it. */
export function tapResponse(data: Record<string, unknown>, id = 'n-1') {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { request: { identifier: id, content: { title: 'Hi', body: 'There', data } } },
  };
}

export const notifications = {
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { MAX: 7, HIGH: 6, DEFAULT: 5 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: notificationState.permission, canAskAgain: notificationState.canAskAgain })),
  requestPermissionsAsync: jest.fn(async () => {
    notificationState.permission = notificationState.promptAnswer;
    return { status: notificationState.promptAnswer, canAskAgain: notificationState.canAskAgain };
  }),
  getExpoPushTokenAsync: jest.fn(async () => {
    if (notificationState.tokenError) throw notificationState.tokenError;
    return { type: 'expo', data: notificationState.token };
  }),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: () => notificationState.lastResponse,
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  setBadgeCountAsync: jest.fn(async (n: number) => {
    notificationState.badge = n;
    return true;
  }),
};

export const device = { isDevice: true };
