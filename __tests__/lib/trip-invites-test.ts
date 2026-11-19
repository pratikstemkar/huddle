import { queueResult, rpcCalls, queriesFor } from '../../test-utils/supabase-mock';
import { acceptTripInvite, inviteToTrip, removeTripInvite } from '@/lib/trip-invites';

describe('trip invite calls', () => {
  it('invites people to a trip', async () => {
    await inviteToTrip('t1', ['u2', 'u3']);
    expect(rpcCalls).toEqual([{ name: 'invite_to_trip', args: { t: 't1', user_ids: ['u2', 'u3'] } }]);
  });

  it('turns a failed invite into a friendly error', async () => {
    queueResult('rpc:invite_to_trip', { error: { message: 'Only the organiser can invite people' } });
    await expect(inviteToTrip('t1', ['u2'])).rejects.toThrow("Couldn't send the invites");
  });

  it('accepts an invite and returns the trip id', async () => {
    queueResult('rpc:accept_trip_invite', { data: 't1' });
    await expect(acceptTripInvite('t1')).resolves.toBe('t1');
  });

  it('says so when an invite is gone', async () => {
    queueResult('rpc:accept_trip_invite', { error: { message: 'That invite is no longer there' } });
    await expect(acceptTripInvite('t1')).rejects.toThrow('That invite is no longer there.');
  });

  it('declines through the table, for me or (as organiser) for someone else', async () => {
    await removeTripInvite('t1', 'u1');
    expect(queriesFor('trip_invites')[0].ops.map((o) => o[0])).toEqual(['delete', 'eq', 'eq']);
  });
});
