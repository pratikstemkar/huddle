import { act, renderHook } from '@testing-library/react-native';

import { deleteMyAccount, describeOutcome, useDeletionPreview, type TripOutcome } from '@/lib/account';
import { queueResult, rpcCalls, supabase } from '../../test-utils/supabase-mock';

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
    expect(rpcCalls.map((c) => c.name)).toEqual(['delete_my_account']);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('stays signed in when the delete fails', async () => {
    queueResult('rpc:delete_my_account', { error: { message: 'offline' } });
    await expect(deleteMyAccount()).rejects.toThrow("Couldn't delete your account. Check your connection and try again.");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
