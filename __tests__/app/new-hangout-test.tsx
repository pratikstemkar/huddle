import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import type { GroupCard, GroupDetail } from '@/lib/groups';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), useAuth: () => ({ session: mockSession }) }));

let mockGroups: { groups: GroupCard[]; loading: boolean; refresh: jest.Mock };
let mockGroup: { group: GroupDetail | null; refresh: jest.Mock };
jest.mock('@/lib/groups', () => ({
  ...jest.requireActual('@/lib/groups'),
  useGroups: () => mockGroups,
  useGroup: () => mockGroup,
}));
jest.mock('@/lib/hangouts', () => ({ ...jest.requireActual('@/lib/hangouts'), createHangout: jest.fn() }));

const { createHangout } = require('@/lib/hangouts') as { createHangout: jest.Mock };
const Clipboard = require('expo-clipboard') as { getStringAsync: jest.Mock };
const NewHangout = require('@/app/(app)/new-hangout').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const p = (id: string, name: string) => ({ user_id: id, display_name: name, avatar_url: null, avatar_color: null });
const card = (id: string, name: string): GroupCard => ({ id, name, color: 'iris', invite_code: 'c', created_at: '', members: 3, trips: 0, myRole: 'admin', faces: [], justJoined: false });

beforeEach(() => {
  mockSession = sessionFor('u1', 'Aarav Shah');
  mockGroups = { groups: [card('g1', 'College gang'), card('g2', 'Flatmates')], loading: false, refresh: jest.fn() };
  mockGroup = {
    group: {
      id: 'g1',
      name: 'College gang',
      color: 'iris',
      invite_code: 'c',
      created_at: '',
      members: [
        { ...p('u1', 'Aarav'), role: 'admin', joined_at: '' },
        { ...p('u2', 'Meera'), role: 'member', joined_at: '' },
        { ...p('u3', 'Kabir'), role: 'member', joined_at: '' },
      ],
      pending: [],
      trips: 0,
      myRole: 'admin',
    },
    refresh: jest.fn(),
  };
  createHangout.mockReset().mockResolvedValue('h1');
  Clipboard.getStringAsync.mockReset();
  setParams({ group: 'g1' });
});

describe('New hangout', () => {
  it('invites the whole group by default and moves on to picking times', async () => {
    await render(<NewHangout />);
    expect(screen.getByText('2 of 2 from College gang')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: suggest times' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: suggest times' }));
    expect(screen.getByText('When could it work?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick at least one time' })).toBeTruthy();
  });

  it('sends the chosen times to the people who are still invited', async () => {
    await render(<NewHangout />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Coffee' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Don’t invite Kabir' }));
    expect(screen.getByText('1 of 2 from College gang')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: suggest times' }));

    // Tomorrow's evening is always still ahead, whatever time the test runs.
    const evening = screen.getAllByRole('button', { name: /, evening$/ });
    await fireEvent.press(evening[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Send 1 option to College gang' }));

    await waitFor(() => expect(createHangout).toHaveBeenCalledTimes(1));
    const arg = createHangout.mock.calls[0][0];
    expect(arg).toEqual(expect.objectContaining({ groupId: 'g1', kind: 'coffee', mode: 'find', durationMin: 120, userIds: ['u2'], placeUrl: null }));
    expect(arg.slots).toHaveLength(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/hangout/[id]', params: { id: 'h1' } });
  });

  it('reads a pasted Google Maps link and refuses other links', async () => {
    await render(<NewHangout />);
    const input = screen.getByLabelText('Google Maps link');
    await fireEvent.changeText(input, 'https://example.com/x');
    expect(screen.getByText('That doesn’t look like a Google Maps link.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: suggest times' }));
    expect(screen.queryByText('When could it work?')).toBeNull();

    Clipboard.getStringAsync.mockResolvedValue('https://www.google.com/maps/place/Nori+House/@1,2,3z');
    await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
    expect(await screen.findByText('Nori House')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove place' }));
    expect(screen.getByLabelText('Google Maps link')).toBeTruthy();
  });

  it('sets one time for an I’ll-pick-it hangout', async () => {
    await render(<NewHangout />);
    await fireEvent.press(screen.getByRole('tab', { name: 'I’ll pick it' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: pick the time' }));
    expect(screen.getByText('When is it?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick the day and time' })).toBeTruthy();
    const days = screen.getAllByRole('button', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+$/ });
    await fireEvent.press(days[days.length - 1]);
    await fireEvent.press(screen.getByRole('button', { name: '7 PM' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send the invite' }));
    await waitFor(() => expect(createHangout).toHaveBeenCalled());
    expect(createHangout.mock.calls[0][0]).toEqual(expect.objectContaining({ mode: 'set', closesAt: null }));
    expect(createHangout.mock.calls[0][0].slots).toHaveLength(1);
  });

  it('points at the Groups tab when I am in no group', async () => {
    mockGroups.groups = [];
    mockGroup.group = null;
    await render(<NewHangout />);
    expect(screen.getByText(/not in a group yet/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: suggest times' }));
    expect(screen.queryByText('When could it work?')).toBeNull();
  });

  it('shows a failed create and stays put', async () => {
    createHangout.mockRejectedValue(new Error("Couldn't create the hangout. Check your connection and try again."));
    await render(<NewHangout />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next: suggest times' }));
    await fireEvent.press(screen.getAllByRole('button', { name: /, evening$/ })[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Send 1 option to College gang' }));
    expect(await screen.findByText("Couldn't create the hangout. Check your connection and try again.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
