import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform, Share } from 'react-native';

import { addDays, formatRange, formatTripDates, today } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';
import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';
import { mockToastShow } from '../../test-utils/ui-mocks';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));
jest.mock('@/lib/calendar', () => ({ addTripToCalendar: jest.fn() }));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

const mockRegisterPip = jest.fn();
jest.mock('@/components/nav/pip-action', () => ({
  useRegisterPipAction: (label: string | null, onPress: (() => void) | null) => mockRegisterPip(label, onPress),
}));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockState }));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const { addTripToCalendar } = require('@/lib/calendar') as { addTripToCalendar: jest.Mock };
const TripScreen = require('@/app/(app)/trip/[id]/(tabs)/index').default as () => React.JSX.Element;
const setString = Clipboard.setStringAsync as jest.Mock;

const pipSays = (text: string) => screen.getByText(`Pip says ${text}`);

const SEEN = `huddle.lockedSeen.${TRIP_ID}`;

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

async function withoutWebShare(fn: () => Promise<void>) {
  const nav = globalThis.navigator as { share?: unknown };
  const prev = nav.share;
  nav.share = undefined;
  try {
    await withOS('web', fn);
  } finally {
    nav.share = prev;
  }
}

describe('Trip screen', () => {
  let share: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip());
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    setString.mockResolvedValue(true);
    addTripToCalendar.mockResolvedValue(undefined);
  });

  afterEach(() => {
    share.mockRestore();
    jest.useRealTimers();
  });

  it('loads on focus and follows live updates', async () => {
    await render(<TripScreen />);
    expect(mockState.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function));
    mockState.refresh.mockClear();
    await act(async () => useTripLive.mock.calls[0][1]());
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('shows Pip and a spinner while loading', async () => {
    mockState = tripState(null, { loading: true });
    await render(<TripScreen />);
    expect(screen.getByLabelText('Loading trip')).toBeTruthy();
  });

  it('explains a missing trip and goes back home', async () => {
    mockState = tripState(null);
    await render(<TripScreen />);
    expect(screen.getByText('Trip not found')).toBeTruthy();
    router.canGoBack.mockReturnValue(false);
    // Both the back arrow and the footer button lead home.
    const [arrow, footer] = screen.getAllByRole('button', { name: 'Back to your trips' });
    await fireEvent.press(arrow);
    await fireEvent.press(footer);
    expect(router.replace).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('offers to retry after an error', async () => {
    mockState = tripState(null, { error: "Couldn't load this trip. Check your connection and try again." });
    await render(<TripScreen />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    mockState.refresh.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('goes home when the trip is deleted while open', async () => {
    const { rerender } = await render(<TripScreen />);
    mockState = tripState(null);
    await rerender(<TripScreen />);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('shows the error banner above a loaded trip', async () => {
    mockState = tripState(trip(), { error: 'Offline' });
    await render(<TripScreen />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('goes back, and opens the invite sheet from the faces and the +', async () => {
    await render(<TripScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to your trips' }));
    expect(router.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '2 people in the huddle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Invite people' }));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/invite', params: { id: TRIP_ID } });
  });

  it('opens settings from the bottom row', async () => {
    await render(<TripScreen />);
    expect(screen.getByText('Rename, privacy, people')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Trip settings' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/settings', params: { id: TRIP_ID } });
  });

  it('tells members the settings row is for leaving', async () => {
    mockSession = sessionFor(MEMBER);
    await render(<TripScreen />);
    expect(screen.getByText('Leave trip')).toBeTruthy();
  });

  describe('hero', () => {
    it('asks when people can go, and opens the dates calendar', async () => {
      await render(<TripScreen />);
      expect(screen.getByText('When can you go?')).toBeTruthy();
      expect(screen.getByText('Nobody has marked their days yet')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: /^Goa in March\. When can you go\?/ }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'dates' } });
    });

    it('counts who has marked', async () => {
      mockState = tripState(trip({ availabilityCount: 1 }));
      await render(<TripScreen />);
      expect(screen.getByText('1 of 2 have marked their free days')).toBeTruthy();
    });

    it('shows the best days so far', async () => {
      mockState = tripState(trip({ availabilityCount: 2, bestDays: [{ start: '2027-03-12', end: '2027-03-13', free: 2 }] }));
      await render(<TripScreen />);
      expect(screen.getByText(formatRange('2027-03-12', '2027-03-13'))).toBeTruthy();
      expect(screen.getByText('Best days so far · 2 of 2 marked')).toBeTruthy();
    });

    it.each([
      [12, 14, '12 days to go'],
      [1, 3, 'Tomorrow!'],
      [0, 2, "Today's the day"],
      [-1, 2, 'Day 2 of 4'],
      [-5, -3, "That's a wrap"],
    ])('counts down for a trip starting in %i days', async (from, to, text) => {
      const start = addDays(today(), from);
      const end = addDays(today(), to);
      mockState = tripState(trip({ fixed_start: start, fixed_end: end }));
      await render(<TripScreen />);
      expect(screen.getByText(text)).toBeTruthy();
      expect(screen.getByText(`${formatRange(start, end)} · 2 friends`)).toBeTruthy();
    });
  });

  describe('area tiles', () => {
    it('summarise each area and open its tab', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Vote, No places yet' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'places' } });
      await fireEvent.press(screen.getByRole('button', { name: 'Plan, Opens once dates are locked' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan', params: { id: TRIP_ID } });
      await fireEvent.press(screen.getByRole('button', { name: 'Split, Nothing spent yet' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/split', params: { id: TRIP_ID } });
      await fireEvent.press(screen.getByRole('button', { name: 'Photos, None yet' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/photos', params: { id: TRIP_ID } });
    });

    it('names the leading place and how many voted', async () => {
      mockState = tripState(trip({ destinations: [destination({ title: 'Palolem', voteCount: 2, voters: [ORGANISER, MEMBER] })] }));
      await render(<TripScreen />);
      expect(screen.getByText('Palolem leads, 2 of 2 voted')).toBeTruthy();
    });

    it('says nobody has voted on a fresh place', async () => {
      mockState = tripState(trip({ destinations: [destination()] }));
      await render(<TripScreen />);
      expect(screen.getByText('Nobody has voted yet')).toBeTruthy();
    });

    it('uses the trip numbers for Plan, Split and Photos', async () => {
      const start = addDays(today(), 10);
      queueResult('trip_stats', {
        data: { trip_id: TRIP_ID, planned_days: [start], photo_count: 24, photo_people: 2, my_photos: 3, spent_minor: 500000, my_net_minor: 125000 },
      });
      mockState = tripState(trip({ fixed_start: start, fixed_end: addDays(start, 2) }));
      await render(<TripScreen />);
      expect(await screen.findByText('1 of 3 days planned')).toBeTruthy();
      expect(screen.getByText('24 so far')).toBeTruthy();
      expect(screen.getByText(/You're owed ₹1,250/)).toBeTruthy();
    });
  });

  describe('Pip says', () => {
    it('asks the organiser to lock once there is a place and dates, and registers the nav action', async () => {
      mockState = tripState(
        trip({ destinations: [destination({ title: 'Palolem' })], bestDays: [{ start: '2027-03-12', end: '2027-03-13', free: 2 }] }),
      );
      await render(<TripScreen />);
      expect(pipSays(`Looks like Palolem on ${formatRange('2027-03-12', '2027-03-13')}. Ready to lock it in?`)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/lock', params: { id: TRIP_ID } });

      expect(mockRegisterPip).toHaveBeenLastCalledWith('Lock', expect.any(Function));
      router.push.mockClear();
      await act(async () => mockRegisterPip.mock.lastCall[1]());
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/lock', params: { id: TRIP_ID } });
    });

    it("doesn't offer locking to members", async () => {
      mockSession = sessionFor(MEMBER);
      mockState = tripState(trip({ destinations: [destination()], bestDays: [{ start: '2027-03-12', end: '2027-03-13', free: 2 }] }));
      await render(<TripScreen />);
      expect(screen.queryByRole('button', { name: 'Lock in the plan' })).toBeNull();
    });

    it('asks me to mark my days', async () => {
      await render(<TripScreen />);
      expect(pipSays("You haven't marked when you're free yet.")).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Mark days' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'dates' } });
    });

    it('invites a first suggestion', async () => {
      mockState = tripState(trip({ iMarked: true }));
      await render(<TripScreen />);
      expect(pipSays('No places yet. Got somewhere in mind?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Suggest' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/suggest', params: { id: TRIP_ID } });
    });

    it('asks me to vote', async () => {
      mockState = tripState(trip({ iMarked: true, destinations: [destination({ title: 'Palolem', voteCount: 1, voters: [MEMBER] })] }));
      await render(<TripScreen />);
      expect(pipSays('Palolem is leading. Got a favourite?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Vote' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'places' } });
    });

    it('nudges the people who have not voted', async () => {
      mockSession = sessionFor(MEMBER);
      mockState = tripState(trip({ iMarked: true, destinations: [destination({ voteCount: 1, voters: [MEMBER], iVoted: true })] }));
      await render(<TripScreen />);
      expect(pipSays('Waiting on 1 more to vote.')).toBeTruthy();
      queueResult('rpc:nudge_trip', { data: 1 });
      await fireEvent.press(screen.getByRole('button', { name: 'Nudge' }));
      expect(rpcCalls).toContainEqual({ name: 'nudge_trip', args: { t: TRIP_ID, what: 'vote' } });
      await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('Nudged 1 person.'));
      expect(share).not.toHaveBeenCalled();
    });

    it('asks a lone member to invite people', async () => {
      mockState = tripState(trip({ iMarked: true, members: [trip().members[0]], destinations: [destination({ iVoted: true, voteCount: 1, voters: [ORGANISER] })] }));
      mockSession = sessionFor(ORGANISER);
      // Without a best range, the organiser isn't asked to lock.
      await render(<TripScreen />);
      expect(pipSays("It's just you so far. Get the gang in.")).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Invite' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/invite', params: { id: TRIP_ID } });
    });
  });

  describe('locked', () => {
    const place = destination({ id: 'd1', title: 'Palolem', note: 'Quiet cove', url: 'https://www.example.com/p', image_url: 'https://img.example.com/p.jpg' });
    const locked = (o = {}) =>
      trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-14', locked_destination_id: 'd1', destinations: [place], ...o });

    beforeEach(async () => {
      await AsyncStorage.setItem(SEEN, '1');
      mockState = tripState(locked());
    });

    it('shows the final dates, nights, place and who is going', async () => {
      await render(<TripScreen />);
      expect(screen.getByText(formatTripDates('2027-03-12', '2027-03-14'))).toBeTruthy();
      expect(screen.getByText('2 nights')).toBeTruthy();
      expect(screen.getAllByText('Palolem').length).toBeGreaterThan(0);
      expect(screen.getByText('Quiet cove')).toBeTruthy();
      expect(screen.getByLabelText('Photo of Palolem')).toBeTruthy();
      expect(screen.getByText(/^2 going/)).toBeTruthy();
      expect(screen.getByText('Palolem won')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Lock in the plan' })).toBeNull();
    });

    it.each([
      ['2027-03-12', 'Day trip'],
      ['2027-03-13', '1 night'],
    ])('describes a trip ending %s as "%s"', async (end, text) => {
      mockState = tripState(locked({ locked_end: end }));
      await render(<TripScreen />);
      expect(screen.getByText(text)).toBeTruthy();
    });

    it('opens the place link', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('link', { name: 'Open link, example.com' }));
      expect(open).toHaveBeenCalledWith('https://www.example.com/p');
      open.mockRestore();
    });

    it('shows the place without optional details', async () => {
      mockState = tripState(locked({ destinations: [destination({ id: 'd1', title: 'Palolem' })] }));
      await render(<TripScreen />);
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByLabelText('Photo of Palolem')).toBeNull();
    });

    it('explains when the chosen place was removed', async () => {
      mockState = tripState(locked({ destinations: [] }));
      await render(<TripScreen />);
      expect(screen.getByText('The chosen place is no longer available.')).toBeTruthy();
    });

    it('shares the plan', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share plan' }));
      expect(share).toHaveBeenCalledWith({
        message: `Goa in March is locked in on Huddle! ${formatTripDates('2027-03-12', '2027-03-14')} · Palolem`,
      });
    });

    it('ignores a cancelled share', async () => {
      share.mockRejectedValue(new Error('cancelled'));
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share plan' }));
    });

    it('copies the plan on browsers without a share sheet and says so', async () => {
      mockState = tripState(locked({ destinations: [] }));
      await withoutWebShare(async () => {
        await render(<TripScreen />);
        await fireEvent.press(screen.getByRole('button', { name: 'Share plan' }));
        expect(setString).toHaveBeenCalledWith(expect.stringContaining('a place to be decided'));
        expect(mockToastShow).toHaveBeenCalledWith('Copied to clipboard');
      });
    });

    it('ignores clipboard failures', async () => {
      setString.mockRejectedValue(new Error('denied'));
      await withoutWebShare(async () => {
        await render(<TripScreen />);
        await fireEvent.press(screen.getByRole('button', { name: 'Share plan' }));
        expect(mockToastShow).not.toHaveBeenCalled();
      });
    });

    it('adds the trip to the calendar', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Add to calendar' }));
      expect(addTripToCalendar).toHaveBeenCalledWith({ id: TRIP_ID, name: 'Goa in March', start: '2027-03-12', end: '2027-03-14', place: 'Palolem' });
    });

    it('tells the group chat from Pip once nothing else is due', async () => {
      await render(<TripScreen />);
      expect(pipSays("It's official. Tell the group chat.")).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
      expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('is locked in on Huddle!') });
    });

    it('celebrates a new lock once', async () => {
      await AsyncStorage.removeItem(SEEN);
      await render(<TripScreen />);
      await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/locked', params: { id: TRIP_ID } }));
      expect(await AsyncStorage.getItem(SEEN)).toBe('1');
    });

    it("doesn't celebrate a lock it has already shown", async () => {
      await render(<TripScreen />);
      await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith(SEEN));
      await act(async () => {});
      expect(router.push).not.toHaveBeenCalledWith({ pathname: '/trip/[id]/locked', params: { id: TRIP_ID } });
    });

    it('celebrates again after an unlock', async () => {
      mockState = tripState(trip());
      await render(<TripScreen />);
      await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SEEN));
      expect(await AsyncStorage.getItem(SEEN)).toBeNull();
    });
  });
});
