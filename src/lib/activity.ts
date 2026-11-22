import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { setBadge } from './notifications';
import { supabase } from './supabase';

export type NotificationKind =
  | 'trip_invite'
  | 'group_invite'
  | 'hangout_invite'
  | 'trip_locked'
  | 'hangout_locked'
  | 'hangout_cancelled'
  | 'nudge_days'
  | 'nudge_vote'
  | 'trip_joined'
  | 'app_release';

export type ActivityItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
};

export const ACTIVITY_LIMIT = 50;
let instances = 0;

/**
 * My latest notifications, newest first, kept live: a new one shows up straight away, and the app icon's
 * badge follows the unread count.
 */
export function useActivity(userId: string | undefined) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, url, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT);
    setError(error ? "Couldn't load your activity. Check your connection and try again." : null);
    if (data) setItems(data as ActivityItem[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!userId) return;
    latest.current();
    const channel = supabase.channel(`activity:${userId}:${++instances}`);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => latest.current());
    channel.subscribe();
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', (s) => s === 'active' && latest.current());
    return () => {
      appState?.remove();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((i) => !i.read_at).length;
  useEffect(() => {
    if (!loading) setBadge(unread);
  }, [unread, loading]);

  /** Marks the given items read (all of them without ids). Updates the list straight away. */
  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((i) => (!i.read_at && (!ids || ids.includes(i.id)) ? { ...i, read_at: now } : i)));
    await supabase.rpc('mark_notifications_read', { ids: ids ?? null });
  }, []);

  return { items, unread, loading, error, refresh, markRead };
}

/** "now", "5m", "3h", "2d", then the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
}

/** Push settings, one switch per kind of notification. Activity always lists everything. */
export type NotificationPrefs = { invites: boolean; plans: boolean; nudges: boolean; joins: boolean; updates: boolean };
export const DEFAULT_PREFS: NotificationPrefs = { invites: true, plans: true, nudges: true, joins: true, updates: true };

export const PREF_LABELS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'invites', label: 'Invites', hint: 'Someone invites you to a trip, group or hangout' },
  { key: 'plans', label: 'Plans settled', hint: 'A trip is locked, or a hangout gets a time or is called off' },
  { key: 'nudges', label: 'Nudges', hint: 'A trip-mate reminds you to mark your days or vote' },
  { key: 'joins', label: 'People joining', hint: 'Someone joins a trip you organise' },
  { key: 'updates', label: 'App updates', hint: 'A new version of Huddle is out' },
];

export async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('invites, plans, nudges, joins, updates')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_PREFS, ...(data as Partial<NotificationPrefs> | null) };
}

export async function savePrefs(userId: string, prefs: NotificationPrefs) {
  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Pings trip-mates who still need to mark their days or vote. Resolves to how many were nudged. */
export async function nudgeTrip(tripId: string, what: 'days' | 'vote'): Promise<number> {
  const { data, error } = await supabase.rpc('nudge_trip', { t: tripId, what });
  if (error) throw new Error(error.code === 'P0001' ? error.message : "Couldn't send the nudge. Check your connection and try again.");
  return (data as number | null) ?? 0;
}

export function nudgeSentText(n: number) {
  if (n === 0) return 'Everyone is already on it.';
  return `Nudged ${n} ${n === 1 ? 'person' : 'people'}.`;
}
