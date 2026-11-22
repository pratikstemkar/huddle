import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import type { GroupCard, GroupDetail } from '@/lib/groups';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), useAuth: () => ({ session: mockSession }) }));

let mockGroups: { groups: GroupCard[]; loading: boolean; refresh: jest.Mock };
let mockGroup: { group: GroupDetail | null; refresh: jest.Mock };
let mockTrip: { trip: { name: string; members: { user_id: string }[] } | null; refresh: jest.Mock };
let mockPending: { pending: { user_id: string }[]; refresh: jest.Mock };
jest.mock('@/lib/groups', () => ({
  ...jest.requireActual('@/lib/groups'),
  useGroups: () => mockGroups,
  useGroup: () => mockGroup,
}));
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockTrip }));
jest.mock('@/lib/trip-invites', () => ({
  ...jest.requireActual('@/lib/trip-invites'),
  usePendingTripInvites: () => mockPending,
  inviteToTrip: jest.fn(),
}));

const { inviteToTrip } = require('@/lib/trip-invites') as { inviteToTrip: jest.Mock };
const InvitePeople = require('@/app/(app)/trip/[id]/invite-people').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const p = (id: string, name: string) => ({ user_id: id, display_name: name, avatar_url: null, avatar_color: null });
const card = (id: string, name: string): GroupCard => ({ id, name, color: 'iris', invite_code: 'c', created_at: '', members: 4, trips: 0, myRole: 'admin', faces: [], justJoined: false });
const detail = (id: string, name: string): GroupDetail => ({
  id,
  name,
  color: 'iris',
  invite_code: 'c',
  created_at: '',
  members: [
    { ...p('u1', 'Aarav'), role: 'admin', joined_at: '' },
    { ...p('u2', 'Meera'), role: 'member', joined_at: '' },
    { ...p('u3', 'Kabir'), role: 'member', joined_at: '' },
    { ...p('u4', 'Zoya'), role: 'member', joined_at: '' },
  ],
  pending: [],
  trips: 0,
  myRole: 'admin',
});

beforeEach(() => {
  mockSession = sessionFor('u1', 'Aarav Shah');
  mockGroups = { groups: [card('g1', 'College gang'), card('g2', 'Flatmates')], loading: false, refresh: jest.fn() };
  mockGroup = { group: detail('g1', 'College gang'), refresh: jest.fn() };
  mockTrip = { trip: { name: 'Goa in March', members: [{ user_id: 'u1' }, { user_id: 'u2' }] }, refresh: jest.fn() };
  mockPending = { pending: [{ user_id: 'u4' }], refresh: jest.fn() };
  inviteToTrip.mockReset().mockResolvedValue(undefined);
  setParams({ id: 't1', group: 'g1' });
});

describe('Who’s invited?', () => {
  it('offers the group’s people who are not in the trip or invited yet, all picked', async () => {
    await render(<InvitePeople />);
    expect(screen.getByText('1 of 1 from College gang')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Meera, In the trip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoya, Invited' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Don’t invite Kabir' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Invite 1 person' }));
    await waitFor(() => expect(inviteToTrip).toHaveBeenCalledWith('t1', ['u3']));
    expect(router.back).toHaveBeenCalled();
  });

  it('leaves someone out for this trip only', async () => {
    await render(<InvitePeople />);
    await fireEvent.press(screen.getByRole('button', { name: 'Don’t invite Kabir' }));
    expect(screen.getByText(/Leaving one person out for this trip only\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick at least one person' })).toBeTruthy();
    expect(inviteToTrip).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'Invite 1 person' })).toBeTruthy();
  });

  it('switches group from the chips', async () => {
    await render(<InvitePeople />);
    await fireEvent.press(screen.getByRole('button', { name: 'Flatmates' }));
    expect(mockGroups.groups.length).toBe(2);
    expect(screen.getByRole('button', { name: 'Flatmates' })).toBeSelected();
  });

  it('points at the Groups tab when I am in no group', async () => {
    mockGroups.groups = [];
    await render(<InvitePeople />);
    expect(screen.getByText(/not in a group yet/)).toBeTruthy();
  });

  it('reports a failed invite and stays open', async () => {
    inviteToTrip.mockRejectedValue(new Error("Couldn't send the invites. Check your connection and try again."));
    await render(<InvitePeople />);
    await fireEvent.press(screen.getByRole('button', { name: 'Invite 1 person' }));
    expect(await screen.findByText("Couldn't send the invites. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});
