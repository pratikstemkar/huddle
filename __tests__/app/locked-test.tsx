import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { addDays, formatRange, today } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('@/lib/calendar', () => ({ addTripToCalendar: jest.fn() }));
const mockSession = sessionFor(ORGANISER);
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockState }));

const { addTripToCalendar } = require('@/lib/calendar') as { addTripToCalendar: jest.Mock };
const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const LockedScreen = require('@/app/(app)/trip/[id]/locked').default as () => React.JSX.Element;

const start = addDays(today(), 12);
const end = addDays(today(), 16);
const locked = (o = {}) =>
  trip({ status: 'locked', locked_start: start, locked_end: end, locked_destination_id: 'd1', destinations: [destination({ id: 'd1', title: 'Goa' })], ...o });

describe('Locked celebration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setParams({ id: TRIP_ID });
    mockState = tripState(locked());
    addTripToCalendar.mockResolvedValue(undefined);
  });

  it('celebrates the place, dates and who is going', async () => {
    await render(<LockedScreen />);
    expect(screen.getByLabelText('Pip jumping for joy')).toBeTruthy();
    expect(screen.getByText("It's official")).toBeTruthy();
    expect(screen.getByText('Goa, here we come!')).toBeTruthy();
    expect(screen.getByText(formatRange(start, end))).toBeTruthy();
    expect(screen.getByText('2 going · 12 days to go')).toBeTruthy();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, mockState.refresh, ['trips', 'trip_members', 'destinations']);
  });

  it('remembers it has been seen', async () => {
    await render(<LockedScreen />);
    await waitFor(async () => expect(await AsyncStorage.getItem(`huddle.lockedSeen.${TRIP_ID}`)).toBe('1'));
  });

  it('goes to the plan', async () => {
    await render(<LockedScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start planning the days' }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan', params: { id: TRIP_ID } });
  });

  it('adds the trip to the calendar', async () => {
    await render(<LockedScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to calendar' }));
    expect(addTripToCalendar).toHaveBeenCalledWith({ id: TRIP_ID, name: 'Goa in March', start, end, place: 'Goa' });
  });

  it('ignores a calendar failure', async () => {
    addTripToCalendar.mockRejectedValue(new Error('cancelled'));
    await render(<LockedScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to calendar' }));
  });

  it('closes, or opens the trip without history', async () => {
    await render(<LockedScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: TRIP_ID } });
  });

  it('still celebrates when the place was removed', async () => {
    mockState = tripState(locked({ destinations: [] }));
    await render(<LockedScreen />);
    expect(screen.getByText('Here we come!')).toBeTruthy();
    expect(screen.getByText('To be decided')).toBeTruthy();
  });

  it('shows a spinner while loading', async () => {
    mockState = tripState(null, { loading: true });
    await render(<LockedScreen />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it.each([
    ['a missing trip', () => tripState(null), "This trip doesn't exist, or you're not a member of it."],
    ['an unlocked trip', () => tripState(trip()), "This trip isn't locked in right now."],
  ])('explains %s', async (_, state, text) => {
    mockState = state();
    await render(<LockedScreen />);
    expect(screen.getByText(text)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(router.back).toHaveBeenCalled();
  });
});
