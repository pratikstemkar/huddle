import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { router } from '../../test-utils/expo-router-mock';
import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';
import { mockToastShow } from '../../test-utils/ui-mocks';
import { addDays, formatRange, formatTripDates, today } from '@/lib/dates';
import type { Trip, TripCover, TripSummary } from '@/lib/trips';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `huddle://${path}` }));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  useAuth: () => ({ session: mockSession }),
}));

let mockProfile: { profile: unknown; loading: boolean; error: null; refresh: jest.Mock };
jest.mock('@/lib/profile', () => ({ useMyProfile: () => mockProfile }));

type TripsState = {
  trips: Trip[];
  covers: Map<string, TripCover>;
  summaries: Map<string, TripSummary>;
  photoCounts: Map<string, number>;
  loading: boolean;
  error: string | null;
  refresh: jest.Mock;
};
let mockTrips: TripsState;
jest.mock('@/lib/trips', () => ({
  ...jest.requireActual('@/lib/trips'),
  useTrips: () => mockTrips,
  leadingPlaceName: jest.fn(),
}));

const { leadingPlaceName } = require('@/lib/trips') as { leadingPlaceName: jest.Mock };
const Home = require('@/app/(app)/(home)/index').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const now = today();
const planning: Trip = {
  id: 't1',
  name: 'Goa in March',
  color: 'coral',
  status: 'planning',
  invite_code: 'goa2027x',
  created_at: '',
  locked_start: null,
  locked_end: null,
  fixed_start: null,
  fixed_end: null,
};
const upcoming: Trip = { ...planning, id: 't2', name: 'Pondy', color: 'mint', status: 'locked', locked_start: addDays(now, 12), locked_end: addDays(now, 14) };
const past: Trip = { ...planning, id: 't3', name: 'Coorg', status: 'locked', locked_start: addDays(now, -30), locked_end: addDays(now, -28) };
const during: Trip = { ...planning, id: 't4', name: 'Hampi', status: 'locked', locked_start: addDays(now, -1), locked_end: addDays(now, 1) };

function summary(trip_id: string, over: Partial<TripSummary> = {}): TripSummary {
  return { trip_id, members: 4, marked: 4, i_marked: true, voters: 4, i_voted: true, places: 2, ...over };
}

describe('Home', () => {
  beforeEach(() => {
    mockSession = sessionFor('u1', 'Aarav Shah');
    mockTrips = { trips: [], covers: new Map(), summaries: new Map(), photoCounts: new Map(), loading: false, error: null, refresh: jest.fn() };
    mockProfile = { profile: null, loading: false, error: null, refresh: jest.fn() };
    leadingPlaceName.mockResolvedValue(null);
  });

  it('greets me by first name and loads trips on focus', async () => {
    await render(<Home />);
    expect(screen.getByText('Hey Aarav')).toBeTruthy();
    expect(screen.getByText('Where to next?')).toBeTruthy();
    expect(screen.getByText('A', { includeHiddenElements: true })).toBeTruthy();
    expect(mockTrips.refresh).toHaveBeenCalled();
    expect(mockProfile.refresh).toHaveBeenCalled();
  });

  it('uses the name from my profile once it loads', async () => {
    mockProfile.profile = { id: 'u1', display_name: 'Ravi Kumar', avatar_url: null, avatar_color: 'iris' };
    await render(<Home />);
    expect(screen.getByText('Hey Ravi')).toBeTruthy();
    expect(screen.getByText('R', { includeHiddenElements: true })).toBeTruthy();
  });

  it('opens my profile from the avatar', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'Your profile' }));
    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  it('shows the empty state with ways to start or join', async () => {
    await render(<Home />);
    expect(screen.getByText('Start your first trip')).toBeTruthy();
    expect(screen.getByText("No trips yet. Start one and I'll round up the gang.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Start a trip' }));
    expect(router.push).toHaveBeenCalledWith('/new-trip');
    await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
    expect(router.push).toHaveBeenCalledWith('/join');
  });

  it('shows Pip thinking instead of the empty state while loading', async () => {
    mockTrips.loading = true;
    await render(<Home />);
    expect(screen.queryByText('Start your first trip')).toBeNull();
    expect(screen.getByText('Loading your trips')).toBeTruthy();
  });

  it('lists trips with status chips and opens one', async () => {
    mockTrips.trips = [planning, upcoming, past];
    mockTrips.summaries = new Map([
      ['t1', summary('t1', { i_marked: false, members: 1, marked: 0 })],
      ['t2', summary('t2', { members: 5, marked: 5 })],
    ]);
    mockTrips.photoCounts = new Map([['t3', 48]]);
    await render(<Home />);
    expect(screen.queryByText('Start your first trip')).toBeNull();
    expect(screen.getByText('Your trips')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Goa in March, Your vote needed' })).toBeTruthy();
    expect(screen.getByText('Dates open · Just you')).toBeTruthy();

    const pondy = formatTripDates(upcoming.locked_start!, upcoming.locked_end!);
    expect(screen.getByRole('button', { name: `Pondy, Planning days, ${pondy}` })).toBeTruthy();
    expect(screen.getByText(`${formatRange(upcoming.locked_start!, upcoming.locked_end!)} · 5 friends`)).toBeTruthy();

    const coorg = formatTripDates(past.locked_start!, past.locked_end!);
    expect(screen.getByRole('button', { name: `Coorg, Done · 48 photos, ${coorg}` })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Goa in March, Your vote needed' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 't1' } });
  });

  it('counts down to an upcoming trip and shows Now during one', async () => {
    mockTrips.trips = [upcoming, during];
    await render(<Home />);
    expect(screen.getByText('12', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('days', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Now', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('on trip', { includeHiddenElements: true })).toBeTruthy();
  });

  it("puts a trip's cover photo in its tile", async () => {
    mockTrips.trips = [planning, past];
    mockTrips.covers = new Map([['t3', { tripId: 't3', path: 't3/p.jpg', url: 'https://signed/coorg' }]]);
    await render(<Home />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('https://signed/coorg');
    expect(tree.match(/"uri":"https:\/\/signed/g)).toHaveLength(1);
  });

  it('shows the loading error', async () => {
    mockTrips.trips = [planning];
    mockTrips.error = "Couldn't load your trips. Check your connection and try again.";
    await render(<Home />);
    expect(screen.getByText("Couldn't load your trips. Check your connection and try again.")).toBeTruthy();
  });

  describe('Pip hero', () => {
    let share: jest.SpyInstance;
    beforeEach(() => {
      share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    });
    afterEach(() => share.mockRestore());

    it('nudges friends who have not marked their days, with counts only', async () => {
      mockTrips.trips = [planning];
      mockTrips.summaries = new Map([['t1', summary('t1', { members: 5, marked: 2 })]]);
      queueResult('rpc:nudge_trip', { data: 3 });
      await render(<Home />);
      expect(screen.getByText('3 of 5 still need to mark their days for Goa in March.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Nudge them' }));
      expect(rpcCalls).toContainEqual({ name: 'nudge_trip', args: { t: 't1', what: 'days' } });
      await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('Nudged 3 people.'));
      expect(share).not.toHaveBeenCalled();
    });

    it('says when everyone was nudged today already', async () => {
      mockTrips.trips = [planning];
      mockTrips.summaries = new Map([['t1', summary('t1', { members: 5, marked: 2 })]]);
      queueResult('rpc:nudge_trip', { error: { message: 'Everyone was nudged about this today already. Try again tomorrow.', code: 'P0001' } });
      await render(<Home />);
      await fireEvent.press(screen.getByRole('button', { name: 'Nudge them' }));
      await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('Everyone was nudged about this today already. Try again tomorrow.'));
    });

    it('does not nudge anyone to mark days when the dates are fixed', async () => {
      const fixed = { ...planning, fixed_start: addDays(now, 12), fixed_end: addDays(now, 15) };
      mockTrips.trips = [fixed];
      mockTrips.summaries = new Map([['t1', summary('t1', { members: 5, marked: 3, i_voted: true })]]);
      await render(<Home />);
      expect(screen.queryByText('Nudge them')).toBeNull();
      expect(screen.getByText('Goa in March is 12 days away. Start packing.')).toBeTruthy();
    });

    it("asks for my vote and names the leader when I haven't voted", async () => {
      leadingPlaceName.mockResolvedValue('Palolem');
      mockTrips.trips = [planning];
      mockTrips.summaries = new Map([['t1', summary('t1', { i_voted: false })]]);
      await render(<Home />);
      expect(await screen.findByText('Got a favourite for Goa in March? Palolem is ahead.')).toBeTruthy();
      expect(leadingPlaceName).toHaveBeenCalledWith('t1');
      await fireEvent.press(screen.getByRole('button', { name: 'Vote' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: 't1', seg: 'places' } });
    });

    it('falls back when nobody leads yet', async () => {
      mockTrips.trips = [planning];
      mockTrips.summaries = new Map([['t1', summary('t1', { i_voted: false })]]);
      await render(<Home />);
      await waitFor(() => expect(leadingPlaceName).toHaveBeenCalled());
      expect(screen.getByText('Got a favourite for Goa in March? Voting is open.')).toBeTruthy();
    });

    it('counts down to the next trip', async () => {
      mockTrips.trips = [upcoming];
      await render(<Home />);
      expect(screen.getByText('Pondy is 12 days away. Start packing.')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 't2' } });
    });
  });

  it('falls back to Traveller without a session', async () => {
    mockSession = null;
    await render(<Home />);
    expect(screen.getByText('Hey Traveller')).toBeTruthy();
  });
});
