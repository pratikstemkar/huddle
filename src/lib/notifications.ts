import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { supabase } from './supabase';

/** Must match ANDROID_CHANNEL in supabase/functions/send-push/push.ts. */
export const ANDROID_CHANNEL = 'default';
const TOKEN_KEY = 'huddle.pushToken';
const ASKED_KEY = 'huddle.pushAsked';

/** Push needs a real phone; web and simulators get the Activity list only. */
export const pushSupported = Platform.OS !== 'web' && Device.isDevice;

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

let configured = false;

/** Shows notifications as banners while the app is open, and creates the Android channel. Safe to call twice. */
export function configureNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  });
  if (Platform.OS === 'android') {
    // Android 13 only shows the permission prompt once a channel exists.
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Trips and invites',
      importance: AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function saveToken(token: string) {
  // The runtime version tells a release announcement whether this phone takes it over the air.
  const { error } = await supabase.rpc('register_push_token', { tok: token, plat: Platform.OS, runtime: Updates.runtimeVersion ?? null });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/**
 * Registers this phone for push. With `prompt`, asks for permission first if it hasn't been asked;
 * without it, only re-registers when permission is already granted. Returns the permission afterwards.
 */
export async function registerForPush({ prompt = false } = {}): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  configureNotifications();
  let permission = await pushPermission();
  if (permission === 'undetermined' && prompt) {
    const { status } = await Notifications.requestPermissionsAsync();
    permission = status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  }
  if (permission !== 'granted') return permission;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await saveToken(data);
  } catch {
    // Offline or Expo unreachable: the next launch tries again.
  }
  return permission;
}

/** Stops pushes to this phone. Call before signing out, while the session can still reach the database. */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { tok: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/**
 * Asks for permission once per phone, the first time it's useful (after starting or joining a trip).
 * `explain` shows Huddle's own sheet first; the system prompt only follows a yes.
 */
export async function askForPushOnce(explain: () => Promise<boolean>) {
  if (!pushSupported) return;
  try {
    if ((await pushPermission()) !== 'undetermined') return;
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    if (await explain()) await registerForPush({ prompt: true });
  } catch {}
}

/**
 * True when the intro should offer push: a real phone that hasn't been asked yet. Checked before sign-in,
 * so it only looks at the permission, never the token.
 */
export async function shouldOfferPush(): Promise<boolean> {
  if (!pushSupported) return false;
  try {
    if ((await pushPermission()) !== 'undetermined') return false;
    return !(await AsyncStorage.getItem(ASKED_KEY));
  } catch {
    return false;
  }
}

/**
 * Shows the system prompt now, without registering a token (the intro runs before sign-in; the token is
 * saved by `useNotifications` once someone signs in). Marks the phone as asked so no other screen asks again.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  configureNotifications();
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1');
    if ((await pushPermission()) !== 'undetermined') return pushPermission();
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export function openSystemSettings() {
  Linking.openSettings().catch(() => {});
}

/** Keeps the app icon's badge in step with unread Activity. */
export function setBadge(count: number) {
  if (!pushSupported) return;
  Notifications.setBadgeCountAsync(count).catch(() => {});
}

/** Only app paths: a push never sends the router to another site. */
export function safeAppPath(url: unknown): string | null {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

/** Where Huddle's APKs are published. The only site a notification may open. */
export const RELEASES_URL = 'https://github.com/pratikstemkar/huddle/releases/';

/** What tapping a notification opens: a screen in the app, or a release page in the browser. */
export type NotificationTarget = { app: string } | { web: string };

export function notificationTarget(url: unknown): NotificationTarget | null {
  const path = safeAppPath(url);
  if (path) return { app: path };
  if (typeof url === 'string' && url.startsWith(RELEASES_URL) && !/\s/.test(url)) return { web: url };
  return null;
}

/** Follows a tapped notification or Activity item. */
export function openNotificationTarget(url: unknown) {
  const target = notificationTarget(url);
  if (!target) return;
  if ('app' in target) router.push(target.app as Href);
  else Linking.openURL(target.web).catch(() => {});
}

/** The native module behind Expo's tap hook doesn't exist on web, where nothing is ever tapped. */
export function lastResponseHook(os: string): () => Notifications.NotificationResponse | null | undefined {
  return os === 'web' ? () => null : Notifications.useLastNotificationResponse;
}
// Platform never changes at runtime, so the hook order stays stable.
const useLastResponse = lastResponseHook(Platform.OS);

/**
 * While signed in: registers this phone if permission was already given, follows token changes, and
 * opens the screen a tapped notification points at (also when the tap launched the app).
 */
export function useNotifications(userId: string | undefined) {
  const handled = useRef<string | null>(null);
  const response = useLastResponse();

  useEffect(() => {
    if (!userId || !pushSupported) return;
    registerForPush().catch(() => {});
    const sub = Notifications.addPushTokenListener(() => {
      registerForPush().catch(() => {});
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (!userId || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = response.notification.request.content.data as { url?: unknown; notificationId?: unknown } | undefined;
    if (typeof data?.notificationId === 'string') {
      supabase.rpc('mark_notifications_read', { ids: [data.notificationId] }).then(
        () => {},
        () => {},
      );
    }
    openNotificationTarget(data?.url);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [userId, response]);
}
