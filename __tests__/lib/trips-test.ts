import { act, renderHook } from '@testing-library/react-native';

import {
  createTrip,
  deleteTrip,
  inviteLink,
  inviteMessage,
  invitePreview,
  joinTrip,
  leaveTrip,
  lockTrip,
  parseInviteCode,
  planMessage,
  removeMember,
  renameTrip,
  setShowWhoMarked,
  unlockTrip,
  updateTrip,
  useTrip,
  useTrips,
} from '@/lib/trips';
import { Platform } from 'react-native';

import { photoState } from '../../test-utils/photo-mocks';
import { queriesFor, queueResult, rpcCalls, storageCallsFor } from '../../test-utils/supabase-mock';

jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));

const TRIP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

describe('createTrip', () => {
  it('inserts the trip and returns the new row', async () => {
    queueResult('trips', { data: { id: TRIP_ID, name: 'Goa' } });
    await expect(createTrip('Goa', 'coral')).resolves.toEqual({ id: TRIP_ID, name: 'Goa' });
    expect(queriesFor('trips')[0].ops).toEqual([
      ['insert', [{ name: 'Goa', color: 'coral' }]],
      ['select', []],
      ['single', []],
    ]);
  });

  it('sets fixed dates when the organiser already knows them', async () => {
    queueResult('trips', { data: { id: TRIP_ID } });
    await createTrip('Goa', 'iris', { start: '2027-03-12', end: '2027-03-14' });
    expect(queriesFor('trips')[0].ops[0]).toEqual(['insert', [{ name: 'Goa', color: 'iris', fixed_start: '2027-03-12', fixed_end: '2027-03-14' }]]);
  });

  it('throws the database error', async () => {
    queueResult('trips', { error: { message: 'too long' } });
    await expect(createTrip('x', 'mint')).rejects.toEqual({ message: 'too long' });
  });
});

describe('joinTrip', () => {
  it('calls join_trip and returns the trip id', async () => {
    queueResult('rpc:join_trip', { data: TRIP_ID });
    await expect(joinTrip('goa2027')).resolves.toBe(TRIP_ID);
    expect(rpcCalls).toEqual([{ name: 'join_trip', args: { code: 'goa2027' } }]);
  });

  it('explains a code that matches no trip', async () => {
    queueResult('rpc:join_trip', { error: { message: 'That invite code does not match a trip' } });
    await expect(joinTrip('nope')).rejects.toThrow("That code doesn't match a trip. Check it and try again.");
  });

  it('gives a connection message for any other failure', async () => {
    queueResult('rpc:join_trip', { error: { message: 'Failed to fetch' } });
    await expect(joinTrip('goa2027')).rejects.toThrow("Couldn't join the trip. Check your connection and try again.");
  });
});

describe('invitePreview', () => {
  it('returns the trip a code points to', async () => {
    queueResult('rpc:invite_preview', { data: [{ name: 'Goa in March', color: 'coral', members: 2 }] });
    await expect(invitePreview('goa2027')).resolves.toEqual({ name: 'Goa in March', color: 'coral', members: 2 });
    expect(rpcCalls).toContainEqual({ name: 'invite_preview', args: { code: 'goa2027' } });
  });

  it('returns null when the code matches nothing', async () => {
    queueResult('rpc:invite_preview', { data: [] });
    await expect(invitePreview('nope')).resolves.toBeNull();
  });

  it('throws on a server error', async () => {
    queueResult('rpc:invite_preview', { error: { message: 'Failed to fetch' } });
    await expect(invitePreview('goa2027')).rejects.toBeTruthy();
  });
});

describe('invite and plan text', () => {
  const env = process.env.EXPO_PUBLIC_APP_URL;
  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_URL = env;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('links to the hosted app when it is set, so friends without the app can open it', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://huddle.example.app/';
    expect(inviteLink('goa2027')).toBe('https://huddle.example.app/invite/goa2027');
  });

  it('falls back to an app link in local native development', () => {
    delete process.env.EXPO_PUBLIC_APP_URL;
    expect(inviteLink('goa2027')).toBe('huddle://invite/goa2027');
  });

  it('links to the hosted app in a release build with no APP_URL, never huddle://', () => {
    delete process.env.EXPO_PUBLIC_APP_URL;
    const g = globalThis as { __DEV__?: boolean };
    const dev = g.__DEV__;
    g.__DEV__ = false;
    try {
      expect(inviteLink('goa2027')).toBe('https://huddletrips.vercel.app/invite/goa2027');
    } finally {
      g.__DEV__ = dev;
    }
  });

  it('uses the page origin on web', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://huddle.example.app';
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const prev = (globalThis as { location?: unknown }).location;
    Object.defineProperty(globalThis, 'location', { value: { origin: 'http://localhost:8091' }, configurable: true });
    try {
      expect(inviteLink('a b')).toBe('http://localhost:8091/invite/a%20b');
    } finally {
      Object.defineProperty(globalThis, 'location', { value: prev, configurable: true });
    }
  });

  it('includes the trip name, code and link in the invite', () => {
    delete process.env.EXPO_PUBLIC_APP_URL;
    expect(inviteMessage('Goa in March', 'goa2027')).toBe('Join "Goa in March" on Huddle! Use code goa2027, or open huddle://invite/goa2027');
  });

  it('describes a locked plan', () => {
    expect(planMessage('Goa', '12–14 Mar', 'Palolem')).toBe('Goa is locked in on Huddle! 12–14 Mar · Palolem');
  });
});

describe('renameTrip', () => {
  it('updates the name', async () => {
    await renameTrip(TRIP_ID, 'New name');
    expect(queriesFor('trips')[0].ops).toEqual([
      ['update', [{ name: 'New name' }]],
      ['eq', ['id', TRIP_ID]],
    ]);
  });

  it('throws the database error', async () => {
    queueResult('trips', { error: { message: 'denied' } });
    await expect(renameTrip(TRIP_ID, 'x')).rejects.toEqual({ message: 'denied' });
  });
});

describe('updateTrip', () => {
  it('updates only the fields given', async () => {
    await updateTrip(TRIP_ID, { color: 'mint', fixed_start: '2027-03-12', fixed_end: '2027-03-14' });
    expect(queriesFor('trips')[0].ops).toEqual([
      ['update', [{ color: 'mint', fixed_start: '2027-03-12', fixed_end: '2027-03-14' }]],
      ['eq', ['id', TRIP_ID]],
    ]);
  });

  it('clears fixed dates to let the group vote again', async () => {
    await updateTrip(TRIP_ID, { fixed_start: null, fixed_end: null });
    expect(queriesFor('trips')[0].ops[0]).toEqual(['update', [{ fixed_start: null, fixed_end: null }]]);
  });

  it('throws the database error', async () => {
    queueResult('trips', { error: { message: 'check violation' } });
    await expect(updateTrip(TRIP_ID, { name: 'x' })).rejects.toEqual({ message: 'check violation' });
  });
});

describe('parseInviteCode', () => {
  it.each([
    ['goa2027', 'goa2027'],
    ['  goa2027 \n', 'goa2027'],
    ['https://huddle.example.app/invite/goa2027', 'goa2027'],
    ['http://localhost:8091/invite/goa2027?ref=x#top', 'goa2027'],
    ['huddle://invite/goa2027', 'goa2027'],
    ['Join "Goa" on Huddle! Use code goa2027, or open https://h.app/invite/goa2027', 'goa2027'],
    ['https://h.app/invite/a%20b', 'a b'],
    ['https://h.app/invite/%E0%A4%A', '%E0%A4%A'],
    ['', ''],
  ])('reads %p as %p', (input, code) => {
    expect(parseInviteCode(input)).toBe(code);
  });
});

describe('setShowWhoMarked', () => {
  it('updates the trip setting', async () => {
    queueResult('trips', { data: [{ id: TRIP_ID }] });
    await setShowWhoMarked(TRIP_ID, false);
    expect(queriesFor('trips')[0].ops).toEqual([
      ['update', [{ show_who_marked: false }]],
      ['eq', ['id', TRIP_ID]],
      ['select', ['id']],
    ]);
  });

  it('throws when RLS hides the change (not the organiser)', async () => {
    queueResult('trips', { data: [] });
    await expect(setShowWhoMarked(TRIP_ID, false)).rejects.toThrow('Not changed');
  });

  it('passes database errors on', async () => {
    queueResult('trips', { error: { message: 'offline' } });
    await expect(setShowWhoMarked(TRIP_ID, true)).rejects.toEqual({ message: 'offline' });
  });
});

describe('deleteTrip', () => {
  it('deletes the trip', async () => {
    queueResult('trips', { data: [{ id: TRIP_ID }] });
    await deleteTrip(TRIP_ID);
    expect(queriesFor('trips')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['id', TRIP_ID]],
      ['select', ['id']],
    ]);
  });

  it("clears the trip's photos from the device", async () => {
    photoState.files.add(`file:///docs/huddle/trips/${TRIP_ID}/places/d1.jpg`);
    photoState.files.add('file:///docs/huddle/trips/other/places/d2.jpg');
    queueResult('trips', { data: [{ id: TRIP_ID }] });
    await deleteTrip(TRIP_ID);
    expect([...photoState.files]).toEqual(['file:///docs/huddle/trips/other/places/d2.jpg']);
  });

  it("removes the trip's place photos and album before the trip", async () => {
    queueResult('storage:list', { data: [{ name: 'd1.jpg' }] }, { data: [{ name: 'p1.jpg' }, { name: 'p1-thumb.jpg' }] });
    queueResult('trips', { data: [{ id: TRIP_ID }] });
    await deleteTrip(TRIP_ID);
    expect(storageCallsFor('remove').map((c) => [c.bucket, c.args[0]])).toEqual([
      ['place-photos', [`${TRIP_ID}/d1.jpg`]],
      ['trip-photos', [`${TRIP_ID}/p1.jpg`, `${TRIP_ID}/p1-thumb.jpg`]],
    ]);
  });

  it('keeps the trip when its album cannot be removed', async () => {
    queueResult('storage:list', { data: [] }, { error: { message: 'offline' } });
    await expect(deleteTrip(TRIP_ID)).rejects.toEqual({ message: 'offline' });
    expect(queriesFor('trips')).toHaveLength(0);
  });

  it('keeps the trip when its photos cannot be removed', async () => {
    queueResult('storage:list', { error: { message: 'offline' } });
    await expect(deleteTrip(TRIP_ID)).rejects.toEqual({ message: 'offline' });
    expect(queriesFor('trips')).toHaveLength(0);
  });

  it('throws when nothing was deleted (not the organiser)', async () => {
    queueResult('trips', { data: [] });
    await expect(deleteTrip(TRIP_ID)).rejects.toThrow('Not deleted');
  });

  it('throws the database error', async () => {
    queueResult('trips', { error: { message: 'offline' } });
    await expect(deleteTrip(TRIP_ID)).rejects.toEqual({ message: 'offline' });
  });
});

describe('leaveTrip', () => {
  it('removes my membership', async () => {
    queueResult('trip_members', { data: [{ user_id: 'me' }] });
    await leaveTrip(TRIP_ID, 'me');
    expect(queriesFor('trip_members')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['trip_id', TRIP_ID]],
      ['eq', ['user_id', 'me']],
      ['select', ['user_id']],
    ]);
  });

  it("clears the trip's photos from the device", async () => {
    photoState.files.add(`file:///docs/huddle/trips/${TRIP_ID}/places/d1.jpg`);
    queueResult('trip_members', { data: [{ user_id: 'me' }] });
    await leaveTrip(TRIP_ID, 'me');
    expect(photoState.files.size).toBe(0);
  });

  it('throws when I was not a member', async () => {
    queueResult('trip_members', { data: [] });
    await expect(leaveTrip(TRIP_ID, 'me')).rejects.toThrow('Not a member');
  });

  it('throws the database error (e.g. last organiser)', async () => {
    queueResult('trip_members', { error: { message: 'The last organiser cannot leave the trip' } });
    await expect(leaveTrip(TRIP_ID, 'me')).rejects.toEqual({ message: 'The last organiser cannot leave the trip' });
  });
});

describe('lockTrip', () => {
  it('calls lock_trip with the dates and destination', async () => {
    await lockTrip(TRIP_ID, '2027-03-12', '2027-03-14', 'd1');
    expect(rpcCalls).toEqual([{ name: 'lock_trip', args: { t: TRIP_ID, start_day: '2027-03-12', end_day: '2027-03-14', destination: 'd1' } }]);
  });

  it('throws the database error', async () => {
    queueResult('rpc:lock_trip', { error: { message: 'This trip is already locked' } });
    await expect(lockTrip(TRIP_ID, '2027-03-12', '2027-03-14', 'd1')).rejects.toEqual({ message: 'This trip is already locked' });
  });
});

describe('unlockTrip', () => {
  it('calls unlock_trip', async () => {
    await unlockTrip(TRIP_ID);
    expect(rpcCalls).toEqual([{ name: 'unlock_trip', args: { t: TRIP_ID } }]);
  });

  it('throws the database error', async () => {
    queueResult('rpc:unlock_trip', { error: { message: 'This trip is not locked' } });
    await expect(unlockTrip(TRIP_ID)).rejects.toEqual({ message: 'This trip is not locked' });
  });
});

describe('removeMember', () => {
  it("deletes that member's row", async () => {
    queueResult('trip_members', { data: [{ user_id: 'them' }] });
    await removeMember(TRIP_ID, 'them');
    expect(queriesFor('trip_members')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['trip_id', TRIP_ID]],
      ['eq', ['user_id', 'them']],
      ['select', ['user_id']],
    ]);
  });

  it('throws when RLS removed nothing', async () => {
    queueResult('trip_members', { data: [] });
    await expect(removeMember(TRIP_ID, 'them')).rejects.toThrow('Not removed');
  });

  it('throws the database error', async () => {
    queueResult('trip_members', { error: { message: 'offline' } });
    await expect(removeMember(TRIP_ID, 'them')).rejects.toEqual({ message: 'offline' });
  });
});

describe('useTrips', () => {
  it('loads my trips, newest first', async () => {
    queueResult('trips', { data: [{ id: TRIP_ID, name: 'Goa' }] });
    const { result } = await renderHook(() => useTrips());
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ loading: false, error: null, trips: [{ id: TRIP_ID, name: 'Goa' }] });
    expect(queriesFor('trips')[0].ops[1]).toEqual(['order', ['created_at', { ascending: false }]]);
  });

  it('loads cover photos, signing uploaded ones', async () => {
    queueResult('trips', { data: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] });
    queueResult('trip_covers', {
      data: [
        { trip_id: 't1', image_path: 't1/a.jpg', image_url: null },
        { trip_id: 't2', image_path: null, image_url: 'https://img/b.jpg' },
        { trip_id: 't3', image_path: 't3/gone.jpg', image_url: null },
      ],
    });
    queueResult('storage:createSignedUrls', { data: [{ path: 't1/a.jpg', signedUrl: 'https://signed/a' }] });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    expect(Object.fromEntries(result.current.covers)).toEqual({
      t1: { tripId: 't1', path: 't1/a.jpg', url: 'https://signed/a' },
      t2: { tripId: 't2', path: null, url: 'https://img/b.jpg' },
    });
    expect(storageCallsFor('createSignedUrls')[0].args[0]).toEqual(['t1/a.jpg', 't3/gone.jpg']);
  });

  it('selects the fixed dates', async () => {
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    expect(queriesFor('trips')[0].ops[0]).toEqual(['select', ['id, name, color, status, invite_code, created_at, locked_start, locked_end, fixed_start, fixed_end']]);
  });

  it('loads the summaries and photo counts behind each card', async () => {
    queueResult('trips', { data: [{ id: 't1' }] });
    const summary = { trip_id: 't1', members: 3, marked: 1, i_marked: true, voters: 2, i_voted: false, places: 2 };
    queueResult('rpc:trip_summaries', { data: [summary] });
    queueResult('trip_stats', { data: [{ trip_id: 't1', photo_count: 12 }] });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    expect(result.current.summaries.get('t1')).toEqual(summary);
    expect(result.current.photoCounts.get('t1')).toBe(12);
    expect(queriesFor('trip_stats')[0].ops).toEqual([['select', ['trip_id, photo_count']]]);
  });

  it('keeps the last summaries and counts when they fail to load', async () => {
    queueResult('trips', { data: [{ id: 't1' }] }, { data: [{ id: 't1' }] });
    queueResult('rpc:trip_summaries', { data: [{ trip_id: 't1', members: 2 }] }, { error: { message: 'offline' } });
    queueResult('trip_stats', { data: [{ trip_id: 't1', photo_count: 3 }] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.error).toBeNull();
    expect(result.current.summaries.get('t1')).toEqual({ trip_id: 't1', members: 2 });
    expect(result.current.photoCounts.get('t1')).toBe(3);
  });

  it('still shows the trips when covers fail to load', async () => {
    queueResult('trips', { data: [{ id: 't1' }] });
    queueResult('trip_covers', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ error: null, trips: [{ id: 't1' }] });
    expect(result.current.covers.size).toBe(0);
  });

  it('keeps the last list and shows an error when loading fails', async () => {
    queueResult('trips', { data: [{ id: TRIP_ID }] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.trips).toEqual([{ id: TRIP_ID }]);
    expect(result.current.error).toBe("Couldn't load your trips. Check your connection and try again.");
  });
});

describe('useTrip', () => {
  afterEach(() => jest.useRealTimers());

  const trip = { id: TRIP_ID, name: 'Goa', created_by: 'org', status: 'planning' };

  function queueTrip(overrides: Partial<Record<'trips' | 'trip_members' | 'destinations' | 'votes' | 'day_counts' | 'marked', object>> = {}) {
    queueResult('trips', overrides.trips ?? { data: trip });
    queueResult(
      'trip_members',
      overrides.trip_members ?? {
        data: [
          { user_id: 'm1', role: 'member', joined_at: '2027-01-02', profiles: { display_name: 'Meera', avatar_url: null, avatar_color: 'iris' } },
          { user_id: 'org', role: 'organiser', joined_at: '2027-01-01', profiles: { display_name: 'Aarav', avatar_url: 'https://a.png', avatar_color: null } },
          { user_id: 'm2', role: 'member', joined_at: '2027-01-03', profiles: null },
        ],
      },
    );
    queueResult(
      'destinations',
      overrides.destinations ?? {
        data: [
          { id: 'd1', trip_id: 't1', title: 'A', note: null, url: null, image_url: null, image_path: null, created_by: 'org', created_at: '2027-01-01' },
          { id: 'd2', trip_id: 't1', title: 'B', note: null, url: null, image_url: null, image_path: null, created_by: 'org', created_at: '2027-01-02' },
        ],
      },
    );
    queueResult('votes', overrides.votes ?? { data: [{ destination_id: 'd2', user_id: 'me' }] });
    queueResult(
      'day_counts',
      overrides.day_counts ?? {
        data: [
          { day: '2027-03-10', free: 2 },
          { day: '2027-03-11', free: 1 },
        ],
      },
    );
    queueResult('rpc:marked_member_count', overrides.marked ?? { data: 2 });
  }

  it('loads the trip with members, ranked places and best days', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2027, 2, 1, 12));
    queueTrip();
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());

    const t = result.current.trip!;
    expect(result.current.error).toBeNull();
    expect(t.name).toBe('Goa');
    expect(t.members).toEqual([
      { user_id: 'org', role: 'organiser', joined_at: '2027-01-01', display_name: 'Aarav', avatar_url: 'https://a.png', avatar_color: null },
      { user_id: 'm1', role: 'member', joined_at: '2027-01-02', display_name: 'Meera', avatar_url: null, avatar_color: 'iris' },
      { user_id: 'm2', role: 'member', joined_at: '2027-01-03', display_name: 'Traveller', avatar_url: null, avatar_color: null },
    ]);
    expect(t.destinations.map((d) => [d.id, d.iVoted])).toEqual([
      ['d2', true],
      ['d1', false],
    ]);
    expect(t.availabilityCount).toBe(2);
    expect(t.bestDays).toEqual([{ start: '2027-03-10', end: '2027-03-10', free: 2 }]);
    // Counts and a headcount, never other people's rows, so this works when names are hidden.
    // The only availability query is for my own rows.
    expect(queriesFor('availability').map((q) => q.ops)).toEqual([
      [
        ['select', ['day']],
        ['eq', ['trip_id', TRIP_ID]],
        ['eq', ['user_id', 'me']],
        ['limit', [1]],
      ],
    ]);
    expect(queriesFor('day_counts')[0].ops).toEqual([
      ['select', ['day, free']],
      ['eq', ['trip_id', TRIP_ID]],
    ]);
    expect(rpcCalls).toContainEqual({ name: 'marked_member_count', args: { t: TRIP_ID } });
    expect(t.iMarked).toBe(false);
  });

  it('selects the fixed dates, currency and join times', async () => {
    queueTrip();
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(queriesFor('trips')[0].ops[0]).toEqual([
      'select',
      ['id, name, color, status, invite_code, created_at, locked_start, locked_end, fixed_start, fixed_end, created_by, locked_destination_id, show_who_marked, currency'],
    ]);
    expect(queriesFor('trip_members')[0].ops[0]).toEqual(['select', ['user_id, role, joined_at, profiles(display_name, avatar_url, avatar_color)']]);
  });

  it('knows when I have marked a day', async () => {
    queueTrip();
    queueResult('availability', { data: [{ day: '2027-03-10' }] });
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(result.current.trip!.iMarked).toBe(true);
  });

  it("doesn't look for my days without my id", async () => {
    queueTrip();
    const { result } = await renderHook(() => useTrip(TRIP_ID));
    await act(() => result.current.refresh());
    expect(queriesFor('availability')).toHaveLength(0);
    expect(result.current.trip!.iMarked).toBe(false);
  });

  it('shows an error when my days fail to load', async () => {
    queueTrip();
    queueResult('availability', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Couldn't load this trip. Check your connection and try again.");
  });

  it('shows an error when the headcount fails', async () => {
    queueTrip({ marked: { error: { message: 'offline' } } });
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Couldn't load this trip. Check your connection and try again.");
  });

  it("is null when the trip is missing or hidden (I'm not a member)", async () => {
    queueTrip({ trips: { data: null } });
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ trip: null, error: null, loading: false });
  });

  it('shows an error when any query fails', async () => {
    queueTrip({ votes: { error: { message: 'offline' } } });
    const { result } = await renderHook(() => useTrip(TRIP_ID, 'me'));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Couldn't load this trip. Check your connection and try again.");
    expect(result.current.loading).toBe(false);
  });

  it.each([undefined, 'not-a-uuid', '123'])('skips the query for id %p', async (id) => {
    const { result } = await renderHook(() => useTrip(id, 'me'));
    await act(() => result.current.refresh());
    expect(queriesFor('trips')).toHaveLength(0);
    expect(result.current).toMatchObject({ trip: null, error: null, loading: false });
  });
});
