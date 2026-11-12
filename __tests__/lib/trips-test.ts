import { act, renderHook } from '@testing-library/react-native';

import {
  createTrip,
  deleteTrip,
  inviteLink,
  inviteMessage,
  joinTrip,
  leaveTrip,
  lockTrip,
  planMessage,
  removeMember,
  renameTrip,
  unlockTrip,
  useTrip,
  useTrips,
} from '@/lib/trips';
import { queriesFor, queueResult, rpcCalls } from '../../test-utils/supabase-mock';

jest.mock('expo-linking', () => ({
  createURL: (path: string, opts: { queryParams: Record<string, string> }) => `huddle://${path}?code=${opts.queryParams.code}`,
}));

const TRIP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

describe('createTrip', () => {
  it('inserts the trip and returns the new row', async () => {
    queueResult('trips', { data: { id: TRIP_ID, name: 'Goa' } });
    await expect(createTrip('Goa', 'sunset')).resolves.toEqual({ id: TRIP_ID, name: 'Goa' });
    expect(queriesFor('trips')[0].ops).toEqual([
      ['insert', [{ name: 'Goa', color: 'sunset' }]],
      ['select', []],
      ['single', []],
    ]);
  });

  it('throws the database error', async () => {
    queueResult('trips', { error: { message: 'too long' } });
    await expect(createTrip('x', 'sky')).rejects.toEqual({ message: 'too long' });
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

describe('invite and plan text', () => {
  it('builds the join link', () => {
    expect(inviteLink('goa2027')).toBe('huddle://join?code=goa2027');
  });

  it('includes the trip name, code and link in the invite', () => {
    expect(inviteMessage('Goa in March', 'goa2027')).toBe('Join "Goa in March" on Huddle! Use code goa2027, or open huddle://join?code=goa2027');
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

  it('keeps the last list and shows an error when loading fails', async () => {
    queueResult('trips', { data: [{ id: TRIP_ID }] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTrips());
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.trips).toEqual([{ id: TRIP_ID }]);
    expect(result.current.error).toBe("Couldn't load your trips. Pull to retry.");
  });
});

describe('useTrip', () => {
  afterEach(() => jest.useRealTimers());

  const trip = { id: TRIP_ID, name: 'Goa', created_by: 'org', status: 'planning' };

  function queueTrip(overrides: Partial<Record<'trips' | 'trip_members' | 'destinations' | 'votes' | 'availability', object>> = {}) {
    queueResult('trips', overrides.trips ?? { data: trip });
    queueResult(
      'trip_members',
      overrides.trip_members ?? {
        data: [
          { user_id: 'm1', role: 'member', profiles: { display_name: 'Meera', avatar_url: null } },
          { user_id: 'org', role: 'organiser', profiles: { display_name: 'Aarav', avatar_url: 'https://a.png' } },
          { user_id: 'm2', role: 'member', profiles: null },
        ],
      },
    );
    queueResult(
      'destinations',
      overrides.destinations ?? {
        data: [
          { id: 'd1', title: 'A', note: null, url: null, image_url: null, created_by: 'org', created_at: '2027-01-01' },
          { id: 'd2', title: 'B', note: null, url: null, image_url: null, created_by: 'org', created_at: '2027-01-02' },
        ],
      },
    );
    queueResult('votes', overrides.votes ?? { data: [{ destination_id: 'd2', user_id: 'me' }] });
    queueResult(
      'availability',
      overrides.availability ?? {
        data: [
          { user_id: 'org', day: '2027-03-10' },
          { user_id: 'm1', day: '2027-03-10' },
          { user_id: 'org', day: '2027-03-11' },
        ],
      },
    );
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
      { user_id: 'org', role: 'organiser', display_name: 'Aarav', avatar_url: 'https://a.png' },
      { user_id: 'm1', role: 'member', display_name: 'Meera', avatar_url: null },
      { user_id: 'm2', role: 'member', display_name: 'Traveller', avatar_url: null },
    ]);
    expect(t.destinations.map((d) => [d.id, d.iVoted])).toEqual([
      ['d2', true],
      ['d1', false],
    ]);
    expect(t.availabilityCount).toBe(2);
    expect(t.bestDays).toEqual([{ start: '2027-03-10', end: '2027-03-10', free: 2 }]);
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
