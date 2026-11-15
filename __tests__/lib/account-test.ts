import { act, renderHook } from '@testing-library/react-native';

import { deleteMyAccount, describeOutcome, useDeletionPreview, type TripOutcome } from '@/lib/account';
import { photoState } from '../../test-utils/photo-mocks';
import { queriesFor, queueResult, rpcCalls, storageCallsFor, supabase } from '../../test-utils/supabase-mock';

const trip = (outcome: TripOutcome['outcome'], new_organiser: string | null = null): TripOutcome => ({
  trip_id: 't1',
  trip_name: 'Goa in March',
  outcome,
  new_organiser,
});

describe('describeOutcome', () => {
  it('says what happens to each kind of trip', () => {
    expect(describeOutcome(trip('deleted'))).toBe('Goa in March will be deleted. Nobody else is in it.');
    expect(describeOutcome(trip('handed_over', 'Meera'))).toBe('Goa in March passes to Meera as organiser.');
    expect(describeOutcome(trip('handed_over'))).toBe('Goa in March passes to another member as organiser.');
    expect(describeOutcome(trip('left'))).toBe('You’ll leave Goa in March. Everyone else keeps it.');
  });
});

describe('useDeletionPreview', () => {
  it('loads what will happen to my trips', async () => {
    queueResult('rpc:account_deletion_preview', { data: [trip('left')] });
    const { result } = await renderHook(() => useDeletionPreview());
    expect(result.current.trips).toBeNull();
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ error: null, trips: [trip('left')] });
  });

  it('treats no rows as no trips', async () => {
    const { result } = await renderHook(() => useDeletionPreview());
    await act(() => result.current.refresh());
    expect(result.current.trips).toEqual([]);
  });

  it('reports a failed load', async () => {
    queueResult('rpc:account_deletion_preview', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useDeletionPreview());
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ trips: null, error: "Couldn't load your trips. Check your connection and try again." });
  });
});

describe('deleteMyAccount', () => {
  it('deletes the account, then signs out on this device only', async () => {
    await deleteMyAccount();
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview', 'delete_my_account']);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('removes photos only from the trips that are deleted with the account', async () => {
    queueResult('rpc:account_deletion_preview', {
      data: [
        { ...trip('deleted'), trip_id: 'solo' },
        { ...trip('handed_over', 'Meera'), trip_id: 'shared' },
        { ...trip('left'), trip_id: 'joined' },
      ],
    });
    queueResult('storage:list', { data: [{ name: 'p1.jpg' }] });
    photoState.files.add('file:///docs/huddle/trips/solo/places/p1.jpg');
    photoState.files.add('file:///docs/huddle/trips/shared/places/p2.jpg');
    await deleteMyAccount();
    // Both buckets of the deleted trip; nothing for the trips that stay.
    expect(storageCallsFor('list').map((c) => [c.bucket, c.args[0]])).toEqual([
      ['place-photos', 'solo'],
      ['trip-photos', 'solo'],
    ]);
    expect(storageCallsFor('remove')[0].args[0]).toEqual(['solo/p1.jpg']);
    expect([...photoState.files]).toEqual(['file:///docs/huddle/trips/shared/places/p2.jpg']);
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview', 'delete_my_account']);
  });

  it('keeps the account when its photos cannot be removed', async () => {
    queueResult('rpc:account_deletion_preview', { data: [trip('deleted')] });
    queueResult('storage:list', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview']);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('removes my album photos in every trip before deleting the account', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
    queueResult('trip_photos', { data: [{ path: 't2/a.jpg', thumb_path: 't2/a-thumb.jpg' }] });
    await deleteMyAccount();
    expect(queriesFor('trip_photos')[0].ops).toEqual([
      ['select', ['path, thumb_path']],
      ['eq', ['uploaded_by', 'me']],
      ['order', ['id']],
      ['range', [0, 999]],
    ]);
    expect(storageCallsFor('remove')).toEqual([{ bucket: 'trip-photos', method: 'remove', args: [['t2/a.jpg', 't2/a-thumb.jpg']] }]);
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview', 'delete_my_account']);
  });

  it('pages through more than a thousand album photos', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
    const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ path: `t/${from + i}.jpg`, thumb_path: `t/${from + i}-thumb.jpg` }));
    queueResult('trip_photos', { data: rows(1000) }, { data: rows(1, 1000) });
    await deleteMyAccount();
    expect(queriesFor('trip_photos').map((q) => q.ops[3])).toEqual([
      ['range', [0, 999]],
      ['range', [1000, 1999]],
    ]);
    expect(storageCallsFor('remove').map((c) => (c.args[0] as string[]).length)).toEqual([1000, 1000, 2]);
  });

  it('keeps the account when my album photos cannot be listed or removed', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } }, error: null });
    queueResult('trip_photos', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");

    queueResult('trip_photos', { data: [{ path: 't2/a.jpg', thumb_path: 't2/a-thumb.jpg' }] });
    queueResult('storage:remove', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview', 'account_deletion_preview']);
  });

  it('keeps the account when its trips cannot be checked', async () => {
    queueResult('rpc:account_deletion_preview', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");
    expect(rpcCalls.map((c) => c.name)).toEqual(['account_deletion_preview']);
  });

  it('stays signed in when the delete fails', async () => {
    queueResult('rpc:delete_my_account', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
