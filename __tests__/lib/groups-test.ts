import { queueResult, rpcCalls, queriesFor } from '../../test-utils/supabase-mock';
import {
  acceptGroupInvite,
  createGroup,
  groupInviteLink,
  groupInvitePreview,
  groupMonogram,
  groupsSummary,
  groupSub,
  inviteToGroup,
  joinGroup,
  peopleCount,
  removeGroupInvite,
  removeGroupMember,
  setGroupRole,
  updateGroup,
} from '@/lib/groups';

jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));

describe('group wording', () => {
  it('makes a monogram from the first two words, else the first two letters', () => {
    expect(groupMonogram('College gang')).toBe('CG');
    expect(groupMonogram('Flatmates')).toBe('FL');
    expect(groupMonogram('  office lunch crew ')).toBe('OL');
    expect(groupMonogram('')).toBe('?');
  });

  it('counts people and trips', () => {
    expect(peopleCount(1)).toBe('1 person');
    expect(peopleCount(6)).toBe('6 people');
    expect(groupSub(3, 0)).toBe('3 people · no trips yet');
    expect(groupSub(3, 1)).toBe('3 people · 1 trip together');
    expect(groupSub(11, 2)).toBe('11 people · 2 trips together');
  });

  it('summarises invites and groups for the header', () => {
    expect(groupsSummary(0, 1)).toBe('1 group');
    expect(groupsSummary(1, 4)).toBe('1 invite · 4 groups');
    expect(groupsSummary(2, 0)).toBe('2 invites · 0 groups');
  });

  it('builds the join link from the group code', () => {
    expect(groupInviteLink('college1')).toBe('huddle://group-invite/college1');
  });
});

describe('group calls', () => {
  it('creates a group and returns its id', async () => {
    queueResult('rpc:create_group', { data: 'g1' });
    await expect(createGroup('Climbing crew', 'mint', ['u2'])).resolves.toBe('g1');
    expect(rpcCalls).toEqual([{ name: 'create_group', args: { group_name: 'Climbing crew', group_color: 'mint', user_ids: ['u2'] } }]);
  });

  it('turns a failed create into a friendly error', async () => {
    queueResult('rpc:create_group', { error: { message: 'boom' } });
    await expect(createGroup('x', 'iris', [])).rejects.toThrow("Couldn't create the group");
  });

  it('invites people and accepts an invite', async () => {
    await inviteToGroup('g1', ['u2', 'u3']);
    await acceptGroupInvite('g1');
    expect(rpcCalls.map((c) => c.name)).toEqual(['invite_to_group', 'accept_group_invite']);
    expect(rpcCalls[0].args).toEqual({ g: 'g1', user_ids: ['u2', 'u3'] });
  });

  it('says so when an invite is gone', async () => {
    queueResult('rpc:accept_group_invite', { error: { message: 'That invite is no longer there' } });
    await expect(acceptGroupInvite('g1')).rejects.toThrow('That invite is no longer there.');
  });

  it('joins by code and explains an unknown code', async () => {
    queueResult('rpc:join_group', { data: 'g1' });
    await expect(joinGroup('college1')).resolves.toBe('g1');
    queueResult('rpc:join_group', { error: { message: 'That invite code does not match a group' } });
    await expect(joinGroup('nope')).rejects.toThrow("That code doesn't match a group.");
  });

  it('asks for another admin before the last admin leaves', async () => {
    queueResult('group_members', { error: { message: 'Make someone else an admin first' } });
    await expect(removeGroupMember('g1', 'me')).rejects.toThrow('Make someone else an admin first.');
  });

  it('changes roles, removes invites and edits the group through the tables', async () => {
    await setGroupRole('g1', 'u2', 'admin');
    await removeGroupInvite('g1', 'u3');
    await updateGroup('g1', { name: 'New name' });
    const ops = (t: string) => queriesFor(t).map((q) => q.ops.map((o) => o[0]));
    expect(ops('group_members')).toEqual([['update', 'eq', 'eq']]);
    expect(ops('group_invites')).toEqual([['delete', 'eq', 'eq']]);
    expect(queriesFor('groups')[0].ops[0]).toEqual(['update', [{ name: 'New name' }]]);
  });

  it('reads a group preview for a signed-out visitor', async () => {
    queueResult('rpc:group_invite_preview', { data: [{ name: 'College gang', color: 'iris', members: 6 }] });
    await expect(groupInvitePreview('college1')).resolves.toEqual({ name: 'College gang', color: 'iris', members: 6 });
    queueResult('rpc:group_invite_preview', { data: [] });
    await expect(groupInvitePreview('nope')).resolves.toBeNull();
  });
});
