import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { formatDay, formatRange } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

let mockAv: {
  myDays: Set<string>;
  counts: Map<string, number>;
  who: Map<string, string[]>;
  loading: boolean;
  error: string | null;
  refresh: jest.Mock;
  setDay: jest.Mock;
};
jest.mock('@/lib/availability', () => ({ ...jest.requireActual('@/lib/availability'), useAvailability: () => mockAv }));

let mockDest: { list: ReturnType<typeof destination>[]; loading: boolean; error: string | null; refresh: jest.Mock; toggleVote: jest.Mock; remove: jest.Mock };
jest.mock('@/lib/destinations', () => ({ ...jest.requireActual('@/lib/destinations'), useDestinations: () => mockDest }));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const DaysScreen = require('@/app/(app)/trip/[id]/days').default as () => React.JSX.Element;
const PlacesScreen = require('@/app/(app)/trip/[id]/places').default as () => React.JSX.Element;

// Fixed "today" so the calendar shows the same months every run.
const TODAY = new Date(2027, 2, 10, 12);
const long = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] });
  jest.setSystemTime(TODAY);
  setParams({ id: TRIP_ID });
  mockSession = sessionFor(ORGANISER);
  mockState = tripState(trip());
  mockAv = { myDays: new Set(), counts: new Map(), who: new Map(), loading: false, error: null, refresh: jest.fn(), setDay: jest.fn() };
  mockDest = { list: [], loading: false, error: null, refresh: jest.fn(), toggleVote: jest.fn(), remove: jest.fn() };
});

afterEach(() => jest.useRealTimers());

describe('Days screen', () => {
  it('loads the trip and days on focus, and live-reloads both', async () => {
    await render(<DaysScreen />);
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockAv.refresh).toHaveBeenCalled();
    mockState.refresh.mockClear();
    mockAv.refresh.mockClear();
    useTripLive.mock.calls[0][1]();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockAv.refresh).toHaveBeenCalled();
  });

  it('shows a spinner while loading', async () => {
    mockAv.loading = true;
    await render(<DaysScreen />);
    expect(screen.getByLabelText('Loading days')).toBeTruthy();
  });

  it.each([
    [null, 'Trip not found', "This trip doesn't exist, or you're not a member of it."],
    ['Offline', 'Something went wrong', 'Offline'],
  ])('explains a missing trip (error %p)', async (error, title, body) => {
    mockState = tripState(null, { error });
    await render(<DaysScreen />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
  });

  it('lets me mark days in My days mode', async () => {
    await render(<DaysScreen />);
    expect(screen.getByText('Tap the days you could go.')).toBeTruthy();
    expect(screen.getByText('Nobody has marked a day yet.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(long('2027-03-15')));
    expect(mockAv.setDay).toHaveBeenCalledWith('2027-03-15', true);
  });

  it('lists the best days', async () => {
    mockAv.counts = new Map([
      ['2027-03-15', 2],
      ['2027-03-16', 2],
    ]);
    await render(<DaysScreen />);
    expect(screen.getByText('Best days')).toBeTruthy();
    expect(screen.getByText(new RegExp(formatRange('2027-03-15', '2027-03-16')))).toBeTruthy();
  });

  it('says when no day suits two people', async () => {
    mockAv.counts = new Map([['2027-03-15', 1]]);
    await render(<DaysScreen />);
    expect(screen.getByText('No day suits two or more people yet.')).toBeTruthy();
  });

  it('shows who is free on a day in Everyone mode', async () => {
    mockAv.counts = new Map([['2027-03-15', 2]]);
    mockAv.who = new Map([['2027-03-15', [ORGANISER, MEMBER]]]);
    await render(<DaysScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    const hint = 'Tap a day to see who is free. Dots show who marked it; your own days have an outline.';
    expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.getByLabelText('Darker means more people are free')).toBeTruthy();
    expect(screen.getByTestId('dots-2027-03-15')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, 2 of 2 free: You, Meera`));
    expect(screen.getByText(`${long('2027-03-15')}: 2 of 2 free`)).toBeTruthy();
    expect(screen.getByLabelText('You')).toBeTruthy();
    expect(screen.getByLabelText('Meera')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(`${long('2027-03-16')}, 0 of 2 free`));
    expect(screen.getByText(`${long('2027-03-16')}: nobody is free`)).toBeTruthy();

    // Tapping the selected day again clears it.
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-16')}, 0 of 2 free`));
    expect(screen.getByText(hint)).toBeTruthy();
  });

  it('shows only counts when the trip hides who marked what', async () => {
    mockState = tripState(trip({ show_who_marked: false }));
    // The database only returns my own rows; counts include everyone.
    mockAv.myDays = new Set(['2027-03-15']);
    mockAv.counts = new Map([['2027-03-15', 2]]);
    mockAv.who = new Map([['2027-03-15', [ORGANISER]]]);
    await render(<DaysScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    expect(screen.getByText('Tap a day to see how many are free. Names are hidden for this trip; your own days have an outline.')).toBeTruthy();
    expect(screen.queryByTestId('dots-2027-03-15')).toBeNull();

    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, you are free, 2 of 2 free`));
    expect(screen.getByText(`${long('2027-03-15')}: 2 of 2 free`)).toBeTruthy();
    expect(screen.getByText('Including you. The organiser has hidden who marked which day.')).toBeTruthy();
    expect(screen.queryByLabelText('You')).toBeNull();
  });

  it('names people who left the trip "Traveller"', async () => {
    mockAv.who = new Map([['2027-03-15', ['gone']]]);
    mockAv.counts = new Map([['2027-03-15', 1]]);
    await render(<DaysScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, 1 of 2 free`));
    expect(screen.getByLabelText('Traveller')).toBeTruthy();
  });

  it('is read-only and shows everyone once locked', async () => {
    mockState = tripState(trip({ status: 'locked' }));
    await render(<DaysScreen />);
    expect(screen.getByText('Locked in. Dates are set.')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText('Darker means more people are free')).toBeTruthy();
  });

  it('shows the availability error', async () => {
    mockAv.error = "Couldn't save that day. Check your connection and try again.";
    await render(<DaysScreen />);
    expect(screen.getByText("Couldn't save that day. Check your connection and try again.")).toBeTruthy();
  });

  it('goes back, or to the trip when there is no history', async () => {
    await render(<DaysScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the trip' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the trip' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: TRIP_ID } });
  });
});

describe('Places screen', () => {
  it('loads on focus and live-reloads', async () => {
    await render(<PlacesScreen />);
    expect(mockDest.refresh).toHaveBeenCalled();
    mockDest.refresh.mockClear();
    useTripLive.mock.calls[0][1]();
    expect(mockDest.refresh).toHaveBeenCalled();
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('shows a spinner while loading', async () => {
    mockDest.loading = true;
    await render(<PlacesScreen />);
    expect(screen.getByLabelText('Loading places')).toBeTruthy();
  });

  it.each([
    [null, 'Trip not found'],
    ['Offline', 'Something went wrong'],
  ])('explains a missing trip (error %p)', async (error, title) => {
    mockState = tripState(null, { error });
    await render(<PlacesScreen />);
    expect(screen.getByText(title)).toBeTruthy();
  });

  it('shows the empty state and opens Suggest', async () => {
    await render(<PlacesScreen />);
    expect(screen.getByText('No places yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest a place' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/suggest', params: { id: TRIP_ID } });
  });

  it('lists places, votes, and lets the organiser remove any of them', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.());
    mockDest.list = [destination({ id: 'd1', title: 'Palolem', created_by: MEMBER })];
    await render(<PlacesScreen />);
    expect(screen.getByText('Suggested by Meera')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Vote for Palolem' }));
    expect(mockDest.toggleVote).toHaveBeenCalledWith('d1');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem' }));
    expect(mockDest.remove).toHaveBeenCalledWith('d1');
  });

  it('lets members remove only their own places', async () => {
    mockSession = sessionFor(MEMBER);
    mockDest.list = [destination({ id: 'd1', title: 'Mine', created_by: MEMBER }), destination({ id: 'd2', title: 'Theirs', created_by: ORGANISER })];
    await render(<PlacesScreen />);
    expect(screen.getByRole('button', { name: 'Remove Mine' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Theirs' })).toBeNull();
  });

  it('is read-only once locked', async () => {
    mockState = tripState(trip({ status: 'locked' }));
    mockDest.list = [destination({ title: 'Palolem' })];
    await render(<PlacesScreen />);
    expect(screen.queryByRole('button', { name: 'Suggest a place' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Palolem' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Vote for Palolem' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows the places error', async () => {
    mockDest.error = "Couldn't save your vote. Check your connection and try again.";
    await render(<PlacesScreen />);
    expect(screen.getByText("Couldn't save your vote. Check your connection and try again.")).toBeTruthy();
  });

  it('goes back, or to the trip when there is no history', async () => {
    await render(<PlacesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the trip' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the trip' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: TRIP_ID } });
  });
});
