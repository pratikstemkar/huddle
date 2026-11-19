import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import type { GroupCard, GroupDetail, GroupInvite, KnownPerson } from '@/lib/groups';
import type { TripInvite } from '@/lib/trip-invites';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), useAuth: () => ({ session: mockSession }) }));

type GroupsState = { groups: GroupCard[]; invites: GroupInvite[]; loading: boolean; error: string | null; refresh: jest.Mock };
let mockGroups: GroupsState;
let mockGroup: { group: GroupDetail | null; loading: boolean; error: string | null; refresh: jest.Mock };
let mockPeople: { people: KnownPerson[]; loading: boolean; error: string | null; refresh: jest.Mock };
let mockTripInvites: { invites: TripInvite[]; error: string | null; refresh: jest.Mock };
jest.mock('@/lib/trip-invites', () => ({
  ...jest.requireActual('@/lib/trip-invites'),
  useMyTripInvites: () => mockTripInvites,
  acceptTripInvite: jest.fn(),
  removeTripInvite: jest.fn(),
}));
jest.mock('@/lib/groups', () => ({
  ...jest.requireActual('@/lib/groups'),
  useGroups: () => mockGroups,
  useGroup: () => mockGroup,
  useKnownPeople: () => mockPeople,
  useGroupsLive: jest.fn(),
  acceptGroupInvite: jest.fn(),
  removeGroupInvite: jest.fn(),
  createGroup: jest.fn(),
  inviteToGroup: jest.fn(),
  setGroupRole: jest.fn(),
  removeGroupMember: jest.fn(),
  updateGroup: jest.fn(),
}));

const lib = require('@/lib/groups') as Record<string, jest.Mock>;
const tripLib = require('@/lib/trip-invites') as Record<string, jest.Mock>;
const Clipboard = require('expo-clipboard') as { setStringAsync: jest.Mock };
const Groups = require('@/app/(app)/(home)/groups').default as () => React.JSX.Element;
const NewGroup = require('@/app/(app)/new-group').default as () => React.JSX.Element;
const GroupDetails = require('@/app/(app)/group/[id]/index').default as () => React.JSX.Element;
const AddToGroup = require('@/app/(app)/group/[id]/add').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const person = (id: string, name: string) => ({ user_id: id, display_name: name, avatar_url: null, avatar_color: null });
const card: GroupCard = {
  id: 'g1',
  name: 'College gang',
  color: 'iris',
  invite_code: 'college1',
  created_at: '',
  members: 4,
  trips: 1,
  myRole: 'member',
  faces: [person('u1', 'Aarav'), person('u2', 'Meera')],
  justJoined: false,
};
const invite: GroupInvite = { group_id: 'g2', group_name: 'Book club', group_color: 'mint', members: 5, from: 'Tanvi', created_at: '' };
const detail = (over: Partial<GroupDetail> = {}): GroupDetail => ({
  id: 'g1',
  name: 'College gang',
  color: 'iris',
  invite_code: 'college1',
  created_at: '',
  members: [
    { ...person('u1', 'Aarav'), role: 'admin', joined_at: '' },
    { ...person('u2', 'Meera'), role: 'member', joined_at: '' },
  ],
  pending: [{ ...person('u3', 'Kabir'), invited_at: '' }],
  trips: 2,
  myRole: 'admin',
  ...over,
});

beforeEach(() => {
  mockSession = sessionFor('u1', 'Aarav Shah');
  mockGroups = { groups: [], invites: [], loading: false, error: null, refresh: jest.fn().mockResolvedValue(undefined) };
  mockTripInvites = { invites: [], error: null, refresh: jest.fn() };
  tripLib.acceptTripInvite.mockReset().mockResolvedValue('t9');
  tripLib.removeTripInvite.mockReset().mockResolvedValue(undefined);
  mockGroup = { group: null, loading: false, error: null, refresh: jest.fn() };
  mockPeople = { people: [], loading: false, error: null, refresh: jest.fn() };
  for (const k of ['acceptGroupInvite', 'removeGroupInvite', 'createGroup', 'inviteToGroup', 'setGroupRole', 'removeGroupMember', 'updateGroup']) lib[k].mockReset().mockResolvedValue(undefined);
  Clipboard.setStringAsync.mockReset();
  setParams({ id: 'g1' });
});

describe('Groups tab', () => {
  it('shows the empty state and a way to make a group', async () => {
    await render(<Groups />);
    expect(screen.getByText('Your people')).toBeTruthy();
    expect(screen.getByText('No groups yet')).toBeTruthy();
    expect(mockGroups.refresh).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'New group' }));
    expect(router.push).toHaveBeenCalledWith('/new-group');
    await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
    expect(router.push).toHaveBeenCalledWith('/join');
  });

  it('lists groups with their size and opens one, or starts a trip with it', async () => {
    mockGroups.groups = [card];
    await render(<Groups />);
    expect(screen.getByText('1 group')).toBeTruthy();
    expect(screen.getByText(/All caught up\. New invites land here\./)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'College gang, 4 people · 1 trip together' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]', params: { id: 'g1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Start a trip with College gang' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/new-trip', params: { group: 'g1' } });
  });

  it('shows invites waiting and joins one', async () => {
    mockGroups.invites = [invite];
    await render(<Groups />);
    expect(screen.getByText('Waiting on you')).toBeTruthy();
    expect(screen.getByText('1 invite · 0 groups')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Join Book club' }));
    await waitFor(() => expect(lib.acceptGroupInvite).toHaveBeenCalledWith('g2'));
    await waitFor(() => expect(mockGroups.refresh).toHaveBeenCalledTimes(2));
  });

  it('shows trip invites next to group invites and joins one, opening the trip', async () => {
    mockGroups.invites = [invite];
    mockTripInvites.invites = [{ trip_id: 't9', trip_name: 'Winter workation', trip_color: 'coral', members: 3, datesSet: false, from: 'Kabir', created_at: '' }];
    await render(<Groups />);
    expect(screen.getByText('2 invites · 0 groups')).toBeTruthy();
    expect(screen.getByText('Trip · dates still open')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Join Winter workation' }));
    await waitFor(() => expect(tripLib.acceptTripInvite).toHaveBeenCalledWith('t9'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 't9' } });
  });

  it('declines a trip invite with my own id', async () => {
    mockTripInvites.invites = [{ trip_id: 't9', trip_name: 'Winter workation', trip_color: 'coral', members: 3, datesSet: true, from: 'Kabir', created_at: '' }];
    await render(<Groups />);
    expect(screen.getByText('Trip · dates set')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Decline Winter workation' }));
    await waitFor(() => expect(tripLib.removeTripInvite).toHaveBeenCalledWith('t9', 'u1'));
  });

  it('declines an invite with my own id', async () => {
    mockGroups.invites = [invite];
    await render(<Groups />);
    await fireEvent.press(screen.getByRole('button', { name: 'Decline Book club' }));
    await waitFor(() => expect(lib.removeGroupInvite).toHaveBeenCalledWith('g2', 'u1'));
  });

  it('says when an invite could not be answered', async () => {
    mockGroups.invites = [invite];
    lib.acceptGroupInvite.mockRejectedValue(new Error('That invite is no longer there.'));
    await render(<Groups />);
    await fireEvent.press(screen.getByRole('button', { name: 'Join Book club' }));
    expect(await screen.findByText('That invite is no longer there.')).toBeTruthy();
  });
});

describe('New group', () => {
  const people = [
    { ...person('u2', 'Meera'), source: 'Goa in March' },
    { ...person('u3', 'Kabir'), source: 'Flatmates' },
  ];

  it('asks for a name before creating', async () => {
    await render(<NewGroup />);
    await fireEvent.press(screen.getByRole('button', { name: 'Create group' }));
    expect(screen.getByText('Give your group a name first.')).toBeTruthy();
    expect(lib.createGroup).not.toHaveBeenCalled();
  });

  it('creates the group with the chosen colour and people, then opens it', async () => {
    mockPeople.people = people;
    lib.createGroup.mockResolvedValue('g9');
    await render(<NewGroup />);
    await fireEvent.changeText(screen.getByLabelText('Group name'), '  Climbing crew ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add Meera' }));
    expect(screen.getByRole('button', { name: 'Create group · invite 1' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create group · invite 1' }));
    await waitFor(() => expect(lib.createGroup).toHaveBeenCalledWith('Climbing crew', 'mint', ['u2']));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/group/[id]', params: { id: 'g9' } });
  });

  it('filters people by name and lets me take someone back off', async () => {
    mockPeople.people = people;
    await render(<NewGroup />);
    await fireEvent.changeText(screen.getByLabelText('Search your people by name'), 'kab');
    expect(screen.queryByRole('button', { name: 'Add Meera' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Kabir' }));
    // The chip and the row button both offer "Remove Kabir".
    await fireEvent.press(screen.getAllByRole('button', { name: 'Remove Kabir' })[0]);
    expect(screen.getByRole('button', { name: 'Create group' })).toBeTruthy();
  });

  it('shows why the list is empty when I know no one yet', async () => {
    await render(<NewGroup />);
    expect(screen.getByText(/People you plan trips with will show up here/)).toBeTruthy();
  });

  it('reports a failed create', async () => {
    lib.createGroup.mockRejectedValue(new Error("Couldn't create the group. Check your connection and try again."));
    await render(<NewGroup />);
    await fireEvent.changeText(screen.getByLabelText('Group name'), 'Crew');
    await fireEvent.press(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText("Couldn't create the group. Check your connection and try again.")).toBeTruthy();
  });
});

describe('Group details', () => {
  it('shows a spinner while loading and a message when the group is gone', async () => {
    mockGroup.loading = true;
    const { unmount } = await render(<GroupDetails />);
    expect(screen.getByLabelText('Loading the group')).toBeTruthy();
    await unmount();
    mockGroup.loading = false;
    await render(<GroupDetails />);
    expect(screen.getByText("This group isn't available any more.")).toBeTruthy();
  });

  it('gives admins edit, add, member menus and the join link', async () => {
    mockGroup.group = detail();
    await render(<GroupDetails />);
    expect(screen.getByText('College gang')).toBeTruthy();
    expect(screen.getByText('2 trips together')).toBeTruthy();
    expect(screen.getByText('Aarav (you)')).toBeTruthy();
    expect(screen.getByText('Invited')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit group name and colour' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]/edit', params: { id: 'g1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/group/[id]/add', params: { id: 'g1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('huddle://group-invite/college1'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('makes a member an admin, removes them, and cancels an invite', async () => {
    mockGroup.group = detail();
    await render(<GroupDetails />);
    await fireEvent.press(screen.getByRole('button', { name: 'Options for Meera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Make admin Meera' }));
    await waitFor(() => expect(lib.setGroupRole).toHaveBeenCalledWith('g1', 'u2', 'admin'));

    await fireEvent.press(screen.getByRole('button', { name: 'Options for Meera' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Meera' }));
    await waitFor(() => expect(lib.removeGroupMember).toHaveBeenCalledWith('g1', 'u2'));

    await fireEvent.press(screen.getByRole('button', { name: 'Options for Kabir' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel invite for Kabir' }));
    await waitFor(() => expect(lib.removeGroupInvite).toHaveBeenCalledWith('g1', 'u3'));
  });

  it('hides admin controls from members', async () => {
    mockGroup.group = detail({ myRole: 'member', members: [{ ...person('u1', 'Aarav'), role: 'member', joined_at: '' }, { ...person('u2', 'Meera'), role: 'admin', joined_at: '' }] });
    await render(<GroupDetails />);
    expect(screen.queryByRole('button', { name: 'Edit group name and colour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Options for Meera' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('starts a trip linked to the group', async () => {
    mockGroup.group = detail();
    await render(<GroupDetails />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start a trip' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/new-trip', params: { group: 'g1' } });
  });

  it('confirms before leaving, then goes back to the Groups tab', async () => {
    mockGroup.group = detail({ myRole: 'member' });
    await render(<GroupDetails />);
    await fireEvent.press(screen.getByRole('button', { name: 'Leave group' }));
    expect(lib.removeGroupMember).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave College gang' }));
    await waitFor(() => expect(lib.removeGroupMember).toHaveBeenCalledWith('g1', 'u1'));
    expect(router.dismissTo).toHaveBeenCalledWith('/groups');
  });

  it('keeps the group open and says why when the last admin tries to leave', async () => {
    mockGroup.group = detail();
    lib.removeGroupMember.mockRejectedValue(new Error('Make someone else an admin first.'));
    await render(<GroupDetails />);
    await fireEvent.press(screen.getByRole('button', { name: 'Leave group' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Leave College gang' }));
    expect(await screen.findByText('Make someone else an admin first.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

describe('Add people to a group', () => {
  it('invites the picked people and skips members and people already invited', async () => {
    mockGroup.group = detail();
    mockPeople.people = [
      { ...person('u2', 'Meera'), source: 'College gang' },
      { ...person('u3', 'Kabir'), source: 'College gang' },
      { ...person('u4', 'Zoya'), source: 'Udaipur' },
    ];
    await render(<AddToGroup />);
    expect(screen.getByText('In the group')).toBeTruthy();
    expect(screen.getAllByText('Invited').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Add Zoya' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Invite 1 person' }));
    await waitFor(() => expect(lib.inviteToGroup).toHaveBeenCalledWith('g1', ['u4']));
    expect(router.back).toHaveBeenCalled();
  });
});
