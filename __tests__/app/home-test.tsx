import { fireEvent, render, screen } from '@testing-library/react-native';

import { router } from '../../test-utils/expo-router-mock';
import { formatTripDates } from '@/lib/dates';
import type { Trip } from '@/lib/trips';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

const mockSignOut = jest.fn();
let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  useAuth: () => ({ session: mockSession, signOut: mockSignOut }),
}));

let mockTrips: { trips: Trip[]; loading: boolean; error: string | null; refresh: jest.Mock };
jest.mock('@/lib/trips', () => ({ useTrips: () => mockTrips }));

const Home = require('@/app/(app)/index').default as () => React.JSX.Element;
const { sessionFor } = require('../../test-utils/fixtures') as typeof import('../../test-utils/fixtures');

const planning: Trip = {
  id: 't1',
  name: 'Goa in March',
  color: 'sunset',
  status: 'planning',
  invite_code: 'goa',
  created_at: '',
  locked_start: null,
  locked_end: null,
};
const locked: Trip = { ...planning, id: 't2', name: 'Pondy', color: 'lagoon', status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-14' };

describe('Home', () => {
  beforeEach(() => {
    mockSession = sessionFor('u1', 'Aarav Shah');
    mockTrips = { trips: [], loading: false, error: null, refresh: jest.fn() };
  });

  it('greets me by first name and loads trips on focus', async () => {
    await render(<Home />);
    expect(screen.getByText('Hey Aarav')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    expect(mockTrips.refresh).toHaveBeenCalled();
  });

  it('shows the empty state when there are no trips', async () => {
    await render(<Home />);
    expect(screen.getByText('Start your first trip')).toBeTruthy();
  });

  it('hides the empty state while loading', async () => {
    mockTrips.loading = true;
    await render(<Home />);
    expect(screen.queryByText('Start your first trip')).toBeNull();
  });

  it('lists planning and locked trips and opens one', async () => {
    mockTrips.trips = [planning, locked];
    await render(<Home />);
    expect(screen.queryByText('Start your first trip')).toBeNull();
    expect(screen.getByRole('button', { name: 'Goa in March, still planning' })).toBeTruthy();
    const dates = formatTripDates('2027-03-12', '2027-03-14');
    expect(screen.getByRole('button', { name: `Pondy, locked in, ${dates}` })).toBeTruthy();
    expect(screen.getByText(dates)).toBeTruthy();
    expect(screen.getByText('Locked in')).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Goa in March, still planning' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 't1' } });
  });

  it('shows the loading error', async () => {
    mockTrips.error = "Couldn't load your trips. Pull to retry.";
    await render(<Home />);
    expect(screen.getByText("Couldn't load your trips. Pull to retry.")).toBeTruthy();
  });

  it('opens new trip and join, and signs out', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'New trip' }));
    expect(router.push).toHaveBeenCalledWith('/new-trip');
    await fireEvent.press(screen.getByRole('button', { name: 'Join with a code' }));
    expect(router.push).toHaveBeenCalledWith('/join');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('falls back to Traveller without a session', async () => {
    mockSession = null;
    await render(<Home />);
    expect(screen.getByText('Hey Traveller')).toBeTruthy();
  });
});
