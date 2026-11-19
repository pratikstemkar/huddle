import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';

import { channels } from '../../test-utils/supabase-mock';
import { router } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, trip, tripState } from '../../test-utils/fixtures';
import type { TripDetail } from '@/lib/trips';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  useAuth: () => ({ session: require('../../test-utils/fixtures').sessionFor('org-id') }),
}));

let mockGroups: { groups: { id: string; name: string }[]; refresh: jest.Mock };
let mockPending: { pending: { user_id: string; display_name: string; avatar_url: null; avatar_color: null; invited_at: string }[]; refresh: jest.Mock };
jest.mock('@/lib/groups', () => ({ ...jest.requireActual('@/lib/groups'), useGroups: () => mockGroups }));
jest.mock('@/lib/trip-invites', () => ({ ...jest.requireActual('@/lib/trip-invites'), usePendingTripInvites: () => mockPending }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockState }));

const { InvitePanel, joinedStatus } = require('@/components/invite-panel') as typeof import('@/components/invite-panel');

const DAY = 86_400_000;

function withMembers(): TripDetail {
  return trip({
    invite_code: 'a1b2c3d4',
    members: [
      { user_id: ORGANISER, role: 'organiser', display_name: 'Maya', avatar_url: null, avatar_color: 'blush', joined_at: new Date(Date.now() - 5 * DAY).toISOString() },
      { user_id: MEMBER, role: 'member', display_name: 'Arjun', avatar_url: null, avatar_color: 'mint', joined_at: new Date(Date.now() - 60_000).toISOString() },
      { user_id: 'z', role: 'member', display_name: 'Zoe', avatar_url: null, avatar_color: null, joined_at: new Date(Date.now() - 3 * DAY).toISOString() },
    ],
  });
}

describe('InvitePanel', () => {
  let share: jest.SpyInstance;
  beforeEach(() => {
    mockState = tripState(withMembers());
    mockGroups = { groups: [], refresh: jest.fn() };
    mockPending = { pending: [], refresh: jest.fn() };
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  });
  afterEach(() => {
    share.mockRestore();
    jest.useRealTimers();
  });

  it('offers to invite a group, naming the one the trip started with', async () => {
    mockGroups.groups = [{ id: 'g1', name: 'College gang' }];
    await render(<InvitePanel tripId={TRIP_ID} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Invite from a group' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/invite-people', params: { id: TRIP_ID } });
    await render(<InvitePanel tripId={TRIP_ID} groupId="g1" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Invite College gang' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/trip/[id]/invite-people', params: { id: TRIP_ID, group: 'g1' } });
  });

  it('hides the group button when I am in no group, and lists people invited but not in yet', async () => {
    mockPending.pending = [{ user_id: 'k', display_name: 'Kabir', avatar_url: null, avatar_color: null, invited_at: '' }];
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(screen.queryByRole('button', { name: 'Invite from a group' })).toBeNull();
    expect(screen.getByText('Invited · 1')).toBeTruthy();
    expect(screen.getByLabelText('Kabir, invited')).toBeTruthy();
  });

  it('shows the code as letter tiles, read out one character at a time', async () => {
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(screen.getByText('Get the gang in')).toBeTruthy();
    expect(screen.getByText('Anyone with the code can join Goa in March.')).toBeTruthy();
    expect(screen.getByLabelText('Invite code a 1 b 2 c 3 d 4')).toBeTruthy();
    for (const ch of ['A', '1', 'B', '2', 'C', '3', 'D', '4']) expect(screen.getAllByText(ch, { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('lists who is in the huddle with when they joined', async () => {
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(screen.getByText('In the huddle · 3')).toBeTruthy();
    expect(screen.getByLabelText('Maya (you), Organiser')).toBeTruthy();
    expect(screen.getByLabelText('Arjun, Just joined')).toBeTruthy();
    expect(screen.getByLabelText('Zoe, Joined 3 days ago')).toBeTruthy();
  });

  it('copies the invite link and says so for a moment', async () => {
    jest.useFakeTimers();
    await render(<InvitePanel tripId={TRIP_ID} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Copy link' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('huddle://invite/a1b2c3d4');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(1900));
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('shares the invite message', async () => {
    await render(<InvitePanel tripId={TRIP_ID} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ message: 'Join "Goa in March" on Huddle! Use code a1b2c3d4, or open huddle://invite/a1b2c3d4' });
  });

  it('copies the message on web without a share sheet', async () => {
    const os = Platform.OS;
    const nav = globalThis.navigator;
    Platform.OS = 'web';
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    try {
      await render(<InvitePanel tripId={TRIP_ID} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      expect(share).not.toHaveBeenCalled();
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('Join "Goa in March" on Huddle!'));
    } finally {
      Platform.OS = os;
      Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    }
  });

  it('listens for new members joining', async () => {
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(channels.length).toBeGreaterThan(0);
  });

  it('shows a spinner while loading and the error after', async () => {
    mockState = tripState(null, { loading: true });
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(screen.getByLabelText('Loading the invite')).toBeTruthy();

    mockState = tripState(null, { error: "Couldn't load this trip. Check your connection and try again." });
    await render(<InvitePanel tripId={TRIP_ID} />);
    expect(screen.getByText("Couldn't load this trip. Check your connection and try again.")).toBeTruthy();
  });
});

describe('joinedStatus', () => {
  const now = new Date();
  it('is fresh for ten minutes', () => {
    expect(joinedStatus(new Date(now.getTime() - 9 * 60_000).toISOString(), now)).toEqual({ text: 'Just joined', fresh: true });
  });
  it('counts days after that', () => {
    expect(joinedStatus(new Date(now.getTime() - DAY).toISOString(), now).text).toBe('Joined yesterday');
    expect(joinedStatus(new Date(now.getTime() - 4 * DAY).toISOString(), now).text).toBe('Joined 4 days ago');
  });
});
