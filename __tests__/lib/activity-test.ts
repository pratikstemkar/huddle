import { act, renderHook, waitFor } from '@testing-library/react-native';

import { loadPrefs, nudgeSentText, nudgeTrip, savePrefs, timeAgo, useActivity, type ActivityItem } from '@/lib/activity';

import { notificationState } from '../../test-utils/notifications-mock';
import { channels, queriesFor, queueResult, rpcCalls } from '../../test-utils/supabase-mock';

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  id: 'n1',
  kind: 'trip_locked',
  title: 'Goa is happening',
  body: 'Palolem · 12–15 Mar',
  url: '/trip/t1',
  created_at: '2026-11-20T10:00:00Z',
  read_at: null,
  ...over,
});

describe('useActivity', () => {
  it('loads my notifications newest first and counts the unread', async () => {
    queueResult('notifications', { data: [item(), item({ id: 'n2', read_at: '2026-11-20T11:00:00Z' })] });
    const { result } = await renderHook(() => useActivity('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unread).toBe(1);
    const ops = queriesFor('notifications')[0].ops;
    expect(ops).toContainEqual(['eq', ['user_id', 'u1']]);
    expect(ops).toContainEqual(['order', ['created_at', { ascending: false }]]);
    expect(notificationState.badge).toBe(1);
  });

  it('reloads when a notification arrives', async () => {
    queueResult('notifications', { data: [] }, { data: [item()] });
    const { result } = await renderHook(() => useActivity('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const ch = channels.find((c) => c.name.startsWith('activity:u1'))!;
    expect(ch.handlers[0].filter).toMatchObject({ table: 'notifications', filter: 'user_id=eq.u1' });
    await act(async () => ch.handlers[0].cb({ old: {} }));
    await waitFor(() => expect(result.current.unread).toBe(1));
  });

  it('marks items read straight away', async () => {
    queueResult('notifications', { data: [item(), item({ id: 'n2' })] });
    const { result } = await renderHook(() => useActivity('u1'));
    await waitFor(() => expect(result.current.unread).toBe(2));
    await act(() => result.current.markRead(['n1']));
    expect(result.current.unread).toBe(1);
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: ['n1'] } });
    await act(() => result.current.markRead());
    expect(result.current.unread).toBe(0);
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: null } });
  });

  it('says when loading failed', async () => {
    queueResult('notifications', { error: { message: 'boom' } });
    const { result } = await renderHook(() => useActivity('u1'));
    await waitFor(() => expect(result.current.error).toMatch("Couldn't load your activity"));
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  it.each([
    ['2026-11-21T11:59:30Z', 'now'],
    ['2026-11-21T11:55:00Z', '5m'],
    ['2026-11-21T09:00:00Z', '3h'],
    ['2026-11-19T12:00:00Z', '2d'],
  ])('%s is %s', (iso, out) => {
    expect(timeAgo(iso, now)).toBe(out);
  });

  it('gives the date after a week', () => {
    expect(timeAgo('2026-11-01T12:00:00Z', now)).toMatch(/1/);
  });
});

describe('nudgeTrip', () => {
  it('returns how many were nudged', async () => {
    queueResult('rpc:nudge_trip', { data: 2 });
    await expect(nudgeTrip('t1', 'vote')).resolves.toBe(2);
    expect(rpcCalls).toContainEqual({ name: 'nudge_trip', args: { t: 't1', what: 'vote' } });
  });

  it("passes the server's own reasons through, and hides the rest", async () => {
    queueResult('rpc:nudge_trip', { error: { message: 'Everyone was nudged about this today already. Try again tomorrow.', code: 'P0001' } });
    await expect(nudgeTrip('t1', 'days')).rejects.toThrow('today already');
    queueResult('rpc:nudge_trip', { error: { message: 'connection reset', code: 'XX000' } });
    await expect(nudgeTrip('t1', 'days')).rejects.toThrow("Couldn't send the nudge");
  });

  it.each([
    [0, 'Everyone is already on it.'],
    [1, 'Nudged 1 person.'],
    [4, 'Nudged 4 people.'],
  ])('%p reads as %p', (n, text) => {
    expect(nudgeSentText(n)).toBe(text);
  });
});

describe('notification prefs', () => {
  it('fills in everything on for someone who never changed them', async () => {
    queueResult('notification_prefs', { data: null });
    await expect(loadPrefs('u1')).resolves.toEqual({ invites: true, plans: true, nudges: true, joins: true, updates: true });
  });

  it('reads saved choices', async () => {
    queueResult('notification_prefs', { data: { invites: true, plans: true, nudges: false, joins: false } });
    await expect(loadPrefs('u1')).resolves.toMatchObject({ nudges: false, joins: false });
  });

  it('saves my row', async () => {
    await savePrefs('u1', { invites: true, plans: false, nudges: true, joins: true, updates: false });
    const [method, args] = queriesFor('notification_prefs')[0].ops[0];
    expect(method).toBe('upsert');
    expect(args[0]).toMatchObject({ user_id: 'u1', plans: false, updates: false });
  });
});
