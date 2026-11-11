import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform, Share } from 'react-native';

import { formatRange, formatTripDates } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string, o: { queryParams: { code: string } }) => `huddle://${path}?code=${o.queryParams.code}` }));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ ...jest.requireActual('@/lib/trips'), useTrip: () => mockState }));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const TripScreen = require('@/app/(app)/trip/[id]/index').default as () => React.JSX.Element;
const setString = Clipboard.setStringAsync as jest.Mock;

const INVITE = 'Join "Goa in March" on Huddle! Use code goa2027, or open huddle://join?code=goa2027';

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

describe('Trip screen', () => {
  let share: jest.SpyInstance;

  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip());
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    setString.mockResolvedValue(true);
  });

  afterEach(() => {
    share.mockRestore();
    jest.useRealTimers();
  });

  it('loads on focus and follows live updates', async () => {
    await render(<TripScreen />);
    expect(mockState.refresh).toHaveBeenCalled();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, mockState.refresh);
  });

  it('shows a spinner while loading', async () => {
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

  describe('planning', () => {
    it('shows the name, status, invite code and members', async () => {
      await render(<TripScreen />);
      expect(screen.getByText('Goa in March')).toBeTruthy();
      expect(screen.getByText('Planning')).toBeTruthy();
      expect(screen.getByLabelText('Invite code g o a 2 0 2 7')).toBeTruthy();
      expect(screen.getByText("Who's going · 2")).toBeTruthy();
      expect(screen.getByLabelText('Aarav, you, organiser')).toBeTruthy();
      expect(screen.getByLabelText('Meera')).toBeTruthy();
    });

    it('copies the code and resets the label', async () => {
      jest.useFakeTimers();
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Copy code' }));
      expect(setString).toHaveBeenCalledWith('goa2027');
      expect(screen.getByText('Copied!')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1800);
      });
      expect(screen.getByText('Friends join with this code')).toBeTruthy();
    });

    it('ignores clipboard failures', async () => {
      setString.mockRejectedValue(new Error('denied'));
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Copy code' }));
      expect(screen.queryByText('Copied!')).toBeNull();
    });

    it('shares the invite', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share invite' }));
      expect(share).toHaveBeenCalledWith({ message: INVITE });
    });

    it('ignores a cancelled share', async () => {
      share.mockRejectedValue(new Error('cancelled'));
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Share invite' }));
    });

    it('copies the invite on browsers without a share sheet', async () => {
      const nav = globalThis.navigator as { share?: unknown };
      const prev = nav.share;
      nav.share = undefined;
      try {
        await withOS('web', async () => {
          await render(<TripScreen />);
          await fireEvent.press(screen.getByRole('button', { name: 'Share invite' }));
          expect(setString).toHaveBeenCalledWith(INVITE);
          expect(share).not.toHaveBeenCalled();
          expect(screen.getByText('Copied!')).toBeTruthy();
        });
      } finally {
        nav.share = prev;
      }
    });

    it('asks people to mark days, then shows the best days', async () => {
      await render(<TripScreen />);
      expect(screen.getByText('Nobody has marked their days yet')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Mark my days' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/days', params: { id: TRIP_ID } });
    });

    it.each([
      [1, '1 of 2 has marked their free days'],
      [2, '2 of 2 have marked their free days'],
    ])('counts %i member(s) who marked days', async (n, text) => {
      mockState = tripState(trip({ availabilityCount: n, bestDays: [{ start: '2027-03-12', end: '2027-03-13', free: 2 }] }));
      await render(<TripScreen />);
      expect(screen.getByText('Best days so far')).toBeTruthy();
      expect(screen.getByText(new RegExp(formatRange('2027-03-12', '2027-03-13')))).toBeTruthy();
      expect(screen.getByText(text)).toBeTruthy();
    });

    it('invites a first suggestion', async () => {
      await render(<TripScreen />);
      expect(screen.getByText('No destinations yet')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Suggest a place' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/suggest', params: { id: TRIP_ID } });
    });

    it('shows the top three places and links to all of them', async () => {
      const places = [
        destination({ id: 'a', title: 'A', voteCount: 3, note: 'Beach' }),
        destination({ id: 'b', title: 'B', voteCount: 1 }),
        destination({ id: 'c', title: 'C' }),
        destination({ id: 'd', title: 'D' }),
      ];
      mockState = tripState(trip({ destinations: places }));
      await render(<TripScreen />);
      expect(screen.getByLabelText('A, 3 votes')).toBeTruthy();
      expect(screen.getByLabelText('B, 1 vote')).toBeTruthy();
      expect(screen.getByLabelText('C, 0 votes')).toBeTruthy();
      expect(screen.queryByLabelText('D, 0 votes')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'See all 4 & vote' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/places', params: { id: TRIP_ID } });
    });

    it('says "See all & vote" for up to three places', async () => {
      mockState = tripState(trip({ destinations: [destination()] }));
      await render(<TripScreen />);
      expect(screen.getByRole('button', { name: 'See all & vote' })).toBeTruthy();
    });

    it('lets the organiser lock the plan and open settings', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Lock in the plan' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/lock', params: { id: TRIP_ID } });
      await fireEvent.press(screen.getByRole('button', { name: 'Trip settings' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/settings', params: { id: TRIP_ID } });
    });

    it("doesn't offer locking to members", async () => {
      mockSession = sessionFor(MEMBER);
      await render(<TripScreen />);
      expect(screen.queryByRole('button', { name: 'Lock in the plan' })).toBeNull();
      expect(screen.getByLabelText('Meera, you')).toBeTruthy();
    });

    it('goes back', async () => {
      await render(<TripScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Back to your trips' }));
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('locked', () => {
    const place = destination({ id: 'd1', title: 'Palolem', note: 'Quiet cove', url: 'https://www.example.com/p', image_url: 'https://img.example.com/p.jpg' });
    const locked = (o = {}) =>
      trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-14', locked_destination_id: 'd1', destinations: [place], ...o });

    beforeEach(() => {
      mockState = tripState(locked());
    });

    it('shows the final dates, nights and place, without invite or lock', async () => {
      await render(<TripScreen />);
      expect(screen.getByText('Locked in')).toBeTruthy();
      expect(screen.getByText(formatTripDates('2027-03-12', '2027-03-14'))).toBeTruthy();
      expect(screen.getByText('2 nights')).toBeTruthy();
      expect(screen.getByText('Palolem')).toBeTruthy();
      expect(screen.getByText('Quiet cove')).toBeTruthy();
      expect(screen.getByLabelText('Photo of Palolem')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
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

    it('copies the plan on browsers without a share sheet', async () => {
      mockState = tripState(locked({ destinations: [] }));
      const nav = globalThis.navigator as { share?: unknown };
      const prev = nav.share;
      nav.share = undefined;
      try {
        await withOS('web', async () => {
          await render(<TripScreen />);
          await fireEvent.press(screen.getByRole('button', { name: 'Share plan' }));
          expect(setString).toHaveBeenCalledWith(expect.stringContaining('a place to be decided'));
          expect(screen.getByText('Copied!')).toBeTruthy();
        });
      } finally {
        nav.share = prev;
      }
    });
  });
});
