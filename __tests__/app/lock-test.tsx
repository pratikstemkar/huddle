import { fireEvent, render, screen } from '@testing-library/react-native';

import { formatRange } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState, lockTrip: jest.fn() }));

const { lockTrip } = require('@/lib/trips') as { lockTrip: jest.Mock };
const LockTrip = require('@/app/(app)/trip/[id]/lock').default as () => React.JSX.Element;

const best = [
  { start: '2027-03-12', end: '2027-03-14', free: 2 },
  { start: '2027-03-20', end: '2027-03-20', free: 2 },
];
const places = [destination({ id: 'd1', title: 'Palolem', voteCount: 2 }), destination({ id: 'd2', title: 'Old Goa', voteCount: 1 })];

describe('Lock the trip', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip({ bestDays: best, destinations: places }));
  });

  it('shows a spinner while loading', async () => {
    mockState = tripState(null, { loading: true });
    await render(<LockTrip />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it.each([
    ['a missing trip', () => tripState(null), "This trip doesn't exist, or you're not a member of it."],
    ['a locked trip', () => tripState(trip({ status: 'locked' })), 'This trip is already locked in.'],
  ])('explains %s', async (_, state, message) => {
    mockState = state();
    await render(<LockTrip />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('is organiser-only', async () => {
    mockSession = sessionFor(MEMBER);
    await render(<LockTrip />);
    expect(screen.getByText('Only the organiser can lock the trip.')).toBeTruthy();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: TRIP_ID } });
  });

  it('suggests the best days and the top place, and locks them in', async () => {
    lockTrip.mockResolvedValue(undefined);
    await render(<LockTrip />);
    expect(screen.getByLabelText('Start date').props.value).toBe('2027-03-12');
    expect(screen.getByLabelText('End date').props.value).toBe('2027-03-14');
    expect(screen.getByRole('radio', { name: `${formatRange('2027-03-12', '2027-03-14')}, 2 of 2 free` }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('radio', { name: 'Palolem, 2 votes' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('radio', { name: 'Old Goa, 1 vote' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(lockTrip).toHaveBeenCalledWith(TRIP_ID, '2027-03-12', '2027-03-14', 'd1');
    expect(router.back).toHaveBeenCalled();
  });

  it('locks a different range and place', async () => {
    await render(<LockTrip />);
    await fireEvent.press(screen.getByRole('radio', { name: `${formatRange('2027-03-20', '2027-03-20')}, 2 of 2 free` }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Old Goa, 1 vote' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(lockTrip).toHaveBeenCalledWith(TRIP_ID, '2027-03-20', '2027-03-20', 'd2');
  });

  it('accepts typed dates', async () => {
    await render(<LockTrip />);
    await fireEvent.changeText(screen.getByLabelText('Start date'), ' 2027-04-01 ');
    await fireEvent.changeText(screen.getByLabelText('End date'), '2027-04-03');
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(lockTrip).toHaveBeenCalledWith(TRIP_ID, '2027-04-01', '2027-04-03', 'd1');
  });

  it.each(['2027-02-31', '2027-3-1', 'soon', ''])('rejects the date %p', async (bad) => {
    await render(<LockTrip />);
    await fireEvent.changeText(screen.getByLabelText('Start date'), bad);
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(screen.getByText('Enter both dates as YYYY-MM-DD, for example 2027-03-14.')).toBeTruthy();
    expect(lockTrip).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Start date'), '2027-03-12');
    expect(screen.queryByText('Enter both dates as YYYY-MM-DD, for example 2027-03-14.')).toBeNull();
  });

  it('rejects an end before the start', async () => {
    await render(<LockTrip />);
    await fireEvent.changeText(screen.getByLabelText('End date'), '2027-03-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(screen.getByText('The end date can’t be before the start date.')).toBeTruthy();
  });

  it('needs a place and dates when nothing is suggested yet', async () => {
    mockState = tripState(trip());
    await render(<LockTrip />);
    expect(screen.getByText('Suggest at least one place first, then come back to lock the trip.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(screen.getByText('Enter both dates as YYYY-MM-DD, for example 2027-03-14.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Start date'), '2027-03-12');
    await fireEvent.changeText(screen.getByLabelText('End date'), '2027-03-12');
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(screen.getByText('Pick a destination first.')).toBeTruthy();
  });

  it('shows an error when locking fails', async () => {
    lockTrip.mockRejectedValue(new Error('already locked'));
    await render(<LockTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
    expect(await screen.findByText("Couldn't lock the trip. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});
