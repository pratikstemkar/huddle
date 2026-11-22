import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import {
  askForPushOnce,
  configureNotifications,
  lastResponseHook,
  notificationTarget,
  openNotificationTarget,
  pushPermission,
  registerForPush,
  requestPushPermission,
  shouldOfferPush,
  safeAppPath,
  unregisterPush,
  useNotifications,
} from '@/lib/notifications';

import { router } from '../../test-utils/expo-router-mock';
import { notifications, notificationState, tapResponse } from '../../test-utils/notifications-mock';
import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('configureNotifications', () => {
  it('shows banners while the app is open', () => {
    configureNotifications();
    expect(notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    configureNotifications();
    expect(notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});

describe('registerForPush', () => {
  it('saves the Expo token when permission is granted', async () => {
    await expect(registerForPush()).resolves.toBe('granted');
    expect(rpcCalls).toContainEqual({ name: 'register_push_token', args: { tok: 'ExponentPushToken[test-token]', plat: 'ios', runtime: 'mock' } });
    expect(await AsyncStorage.getItem('huddle.pushToken')).toBe('ExponentPushToken[test-token]');
  });

  it("doesn't ask without prompt", async () => {
    notificationState.permission = 'undetermined';
    await expect(registerForPush()).resolves.toBe('undetermined');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it('asks with prompt, and saves the token on a yes', async () => {
    notificationState.permission = 'undetermined';
    await expect(registerForPush({ prompt: true })).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(rpcCalls.map((c) => c.name)).toEqual(['register_push_token']);
  });

  it('saves nothing on a no', async () => {
    notificationState.permission = 'undetermined';
    notificationState.promptAnswer = 'denied';
    await expect(registerForPush({ prompt: true })).resolves.toBe('denied');
    expect(rpcCalls).toHaveLength(0);
  });

  it('shrugs off an unreachable Expo', async () => {
    notificationState.tokenError = new Error('offline');
    await expect(registerForPush()).resolves.toBe('granted');
    expect(rpcCalls).toHaveLength(0);
  });

  it("doesn't remember a token the database refused", async () => {
    queueResult('rpc:register_push_token', { error: { message: 'nope' } });
    await registerForPush();
    expect(await AsyncStorage.getItem('huddle.pushToken')).toBeNull();
  });
});

describe('unregisterPush', () => {
  it('forgets this phone', async () => {
    await AsyncStorage.setItem('huddle.pushToken', 'ExponentPushToken[abc]');
    await unregisterPush();
    expect(rpcCalls).toContainEqual({ name: 'unregister_push_token', args: { tok: 'ExponentPushToken[abc]' } });
    expect(await AsyncStorage.getItem('huddle.pushToken')).toBeNull();
  });

  it('does nothing when this phone never registered', async () => {
    await unregisterPush();
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('askForPushOnce', () => {
  it('explains first and asks the system only after a yes, once', async () => {
    notificationState.permission = 'undetermined';
    const explain = jest.fn(async () => true);
    await askForPushOnce(explain);
    expect(explain).toHaveBeenCalledTimes(1);
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);

    notificationState.permission = 'undetermined';
    await askForPushOnce(explain);
    expect(explain).toHaveBeenCalledTimes(1);
  });

  it('never shows the system prompt after "Not now"', async () => {
    notificationState.permission = 'undetermined';
    await askForPushOnce(async () => false);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("doesn't ask when permission was already decided", async () => {
    notificationState.permission = 'denied';
    const explain = jest.fn(async () => true);
    await askForPushOnce(explain);
    expect(explain).not.toHaveBeenCalled();
    await expect(pushPermission()).resolves.toBe('denied');
  });
});

describe('shouldOfferPush', () => {
  it('offers only while the phone has never been asked', async () => {
    notificationState.permission = 'undetermined';
    await expect(shouldOfferPush()).resolves.toBe(true);
    await AsyncStorage.setItem('huddle.pushAsked', '1');
    await expect(shouldOfferPush()).resolves.toBe(false);
  });

  it.each(['granted', 'denied'] as const)('does not offer once permission is %s', async (permission) => {
    notificationState.permission = permission;
    await expect(shouldOfferPush()).resolves.toBe(false);
  });
});

describe('requestPushPermission', () => {
  it('shows the system prompt and marks the phone asked, without saving a token before sign-in', async () => {
    notificationState.permission = 'undetermined';
    notificationState.promptAnswer = 'denied';
    await expect(requestPushPermission()).resolves.toBe('denied');
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
    expect(await AsyncStorage.getItem('huddle.pushAsked')).toBe('1');
  });

  it('never prompts twice', async () => {
    notificationState.permission = 'granted';
    await expect(requestPushPermission()).resolves.toBe('granted');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('safeAppPath', () => {
  it.each([
    ['/trip/abc', '/trip/abc'],
    ['/trip/abc/vote?seg=dates', '/trip/abc/vote?seg=dates'],
    ['//evil.example', null],
    ['https://evil.example', null],
    [42, null],
    [undefined, null],
  ])('reads %p as %p', (input, out) => {
    expect(safeAppPath(input)).toBe(out);
  });
});

describe('notificationTarget', () => {
  it.each([
    ['/trip/t1', { app: '/trip/t1' }],
    ['https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0', { web: 'https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0' }],
    ['https://github.com/someone-else/huddle/releases/tag/v1.4.0', null],
    ['https://github.com/pratikstemkar/huddle/issues', null],
    ['https://github.com/pratikstemkar/huddle/releases/tag/v1 javascript:', null],
    ['https://evil.example/https://github.com/pratikstemkar/huddle/releases/', null],
    [undefined, null],
  ])('reads %p as %p', (input, out) => {
    expect(notificationTarget(input)).toEqual(out);
  });
});

describe('openNotificationTarget', () => {
  it('opens a release page in the browser and leaves the router alone', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    openNotificationTarget('https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0');
    expect(open).toHaveBeenCalledWith('https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0');
    expect(router.push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('opens nothing for a link it does not trust', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    openNotificationTarget('https://evil.example');
    expect(open).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('useNotifications', () => {
  it('registers this phone once signed in', async () => {
    await renderHook(() => useNotifications('u1'));
    await waitFor(() => expect(rpcCalls.map((c) => c.name)).toContain('register_push_token'));
    expect(notifications.addPushTokenListener).toHaveBeenCalled();
  });

  it('opens the screen a tapped notification points at, and marks it read', async () => {
    notificationState.lastResponse = tapResponse({ url: '/trip/t1', notificationId: 'nid' });
    const { rerender } = await renderHook(() => useNotifications('u1'));
    expect(router.push).toHaveBeenCalledWith('/trip/t1');
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: ['nid'] } });
    expect(notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
    // The same tap is only followed once.
    await rerender({});
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('ignores a link to anywhere outside the app', async () => {
    notificationState.lastResponse = tapResponse({ url: 'https://evil.example' });
    await renderHook(() => useNotifications('u1'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the release page a tapped release notification points at', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const url = 'https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0';
    notificationState.lastResponse = tapResponse({ url, notificationId: 'rel' });
    await renderHook(() => useNotifications('u1'));
    expect(open).toHaveBeenCalledWith(url);
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: ['rel'] } });
    open.mockRestore();
  });

  it('waits until signed in', async () => {
    notificationState.lastResponse = tapResponse({ url: '/trip/t1' });
    await renderHook(() => useNotifications(undefined));
    expect(router.push).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('on web', () => {
  it("never calls the native-only tap hook, which would crash the app", () => {
    expect(lastResponseHook('ios')).toBe(notifications.useLastNotificationResponse);
    const spy = jest.spyOn(notifications, 'useLastNotificationResponse');
    expect(lastResponseHook('web')()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
