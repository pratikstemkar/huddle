// The small form screens: join a trip and start a new trip.
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { queueResult } from '../../test-utils/supabase-mock';
import { formatDay, fromDay, today, toDay } from '@/lib/dates';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(), setStringAsync: jest.fn() }));
jest.mock('@/lib/trips', () => ({
  ...jest.requireActual('@/lib/trips'),
  joinTrip: jest.fn(),
  createTrip: jest.fn(),
  updateTrip: jest.fn(),
}));
jest.mock('@/components/invite-panel', () => ({
  InvitePanel: ({ tripId }: { tripId: string }) => {
    const { Text: RNText } = jest.requireActual('react-native');
    return <RNText>Invite panel for {tripId}</RNText>;
  },
}));

const { joinTrip, createTrip, updateTrip } = require('@/lib/trips') as { joinTrip: jest.Mock; createTrip: jest.Mock; updateTrip: jest.Mock };
const JoinTrip = require('@/app/(app)/join').default as () => React.JSX.Element;
const NewTrip = require('@/app/(app)/new-trip').default as () => React.JSX.Element;

describe('Join a trip', () => {
  it('prefills the code from the link', async () => {
    setParams({ code: 'goa2027' });
    await render(<JoinTrip />);
    expect(screen.getByLabelText('Invite code').props.value).toBe('goa2027');
    expect(screen.getByText('Join a trip')).toBeTruthy();
    expect(screen.getByText('Got a code?')).toBeTruthy();
  });

  it('asks for a code before joining', async () => {
    await render(<JoinTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(screen.getByText('Enter the invite code your friend sent you.')).toBeTruthy();
    expect(joinTrip).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'a');
    expect(screen.queryByText('Enter the invite code your friend sent you.')).toBeNull();
  });

  it('joins with the trimmed code, opens the trip over the tabs and clears the field', async () => {
    joinTrip.mockResolvedValue('trip-1');
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), '  goa2027 ');
    await fireEvent(screen.getByLabelText('Invite code'), 'submitEditing');
    expect(joinTrip).toHaveBeenCalledWith('goa2027');
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 'trip-1' } });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(screen.getByLabelText('Invite code').props.value).toBe('');
  });

  it('accepts a pasted invite link', async () => {
    joinTrip.mockResolvedValue('trip-2');
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'https://huddle.app/invite/abcd1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(joinTrip).toHaveBeenCalledWith('abcd1234');
  });

  it('pastes the code from the clipboard', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('Join on Huddle: https://huddle.app/invite/xyz98765');
    await render(<JoinTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Paste invite code' }));
    expect(await screen.findByDisplayValue('xyz98765')).toBeTruthy();
  });

  it('joins a group when the code is a group join link', async () => {
    joinTrip.mockRejectedValue(new Error("That code doesn't match a trip. Check it and try again."));
    queueResult('rpc:join_group', { data: 'group-1' });
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'https://huddle.app/group-invite/college1');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/group/[id]', params: { id: 'group-1' } }));
    expect(joinTrip).toHaveBeenCalledWith('college1');
  });

  it('shows why joining failed', async () => {
    joinTrip.mockRejectedValue(new Error("That code doesn't match a trip. Check it and try again."));
    queueResult('rpc:join_group', { error: { message: 'That invite code does not match a group' } });
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(await screen.findByText("That code doesn't match a trip or group. Check it and try again.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('has a fallback message for non-Error failures', async () => {
    joinTrip.mockRejectedValue('boom');
    await render(<JoinTrip />);
    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: 'Join trip' }));
    expect(await screen.findByText("Couldn't join the trip.")).toBeTruthy();
  });
});

/** Two days in next month, so they're never in the past. */
function nextMonthDays() {
  const d = fromDay(today());
  const first = toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)));
  const last = toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 12)));
  return { first, last };
}
const dayLabel = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });

describe('New trip', () => {
  it('starts on step 1 with the default colour and the group voting on dates', async () => {
    await render(<NewTrip />);
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByText('Start a new trip')).toBeTruthy();
    expect(screen.getByLabelText('Trip name').props.placeholder).toBe('Goa getaway');
    expect(screen.getByLabelText('Trip name').props.maxLength).toBe(60);
    expect(screen.getByRole('radio', { name: 'Iris' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Let the group vote' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Next month' })).toBeNull();
  });

  it('closes', async () => {
    await render(<NewTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('asks for a name first', async () => {
    await render(<NewTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(screen.getByText('Give your trip a name first.')).toBeTruthy();
    expect(createTrip).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'x');
    expect(screen.queryByText('Give your trip a name first.')).toBeNull();
  });

  it('creates the trip with the chosen name and colour, then shows the invite step', async () => {
    createTrip.mockResolvedValue({ id: 't-new' });
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), '  Manali  ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
    expect(screen.getByRole('radio', { name: 'Mint' })).toBeChecked();
    await fireEvent(screen.getByLabelText('Trip name'), 'submitEditing');
    expect(createTrip).toHaveBeenCalledWith('Manali', 'mint', null, null);

    expect(await screen.findByText('Step 2 of 2')).toBeTruthy();
    expect(screen.getByText('Invite panel for t-new')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to the trip' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 't-new' } });
  });

  it('sets fixed dates with the range picker', async () => {
    createTrip.mockResolvedValue({ id: 't-new' });
    const { first, last } = nextMonthDays();
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Goa');
    await fireEvent.press(screen.getByRole('radio', { name: 'I already know' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(screen.getByText('Pick the first and last day of the trip.')).toBeTruthy();
    expect(createTrip).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(first) }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(last) }));
    expect(screen.queryByText('Pick the first and last day of the trip.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(createTrip).toHaveBeenCalledWith('Goa', 'iris', { start: first, end: last }, null);
  });

  it('updates the trip it already made after going back', async () => {
    createTrip.mockResolvedValue({ id: 't-new' });
    updateTrip.mockResolvedValue(undefined);
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Goa');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Trip name').props.value).toBe('Goa');
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Goa getaway');
    await fireEvent.press(screen.getByRole('radio', { name: 'Coral' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(createTrip).toHaveBeenCalledTimes(1);
    expect(updateTrip).toHaveBeenCalledWith('t-new', { name: 'Goa getaway', color: 'coral', fixed_start: null, fixed_end: null });
    expect(await screen.findByText('Step 2 of 2')).toBeTruthy();
  });

  it('shows an error when creating fails', async () => {
    createTrip.mockRejectedValue(new Error('offline'));
    await render(<NewTrip />);
    await fireEvent.changeText(screen.getByLabelText('Trip name'), 'Goa');
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(await screen.findByText("Couldn't create the trip. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText('Step 2 of 2')).toBeNull();
  });
});
