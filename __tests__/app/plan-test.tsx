import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PlanItem } from '@/lib/itinerary';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));
jest.mock('@/components/nav/pip-action', () => ({ useRegisterPipAction: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

let mockItems: PlanItem[] = [];
const mockRefreshPlan = jest.fn();
jest.mock('@/lib/itinerary', () => ({
  ...jest.requireActual('@/lib/itinerary'),
  usePlan: () => ({ items: mockItems, loading: false, error: null, refresh: mockRefreshPlan }),
}));

let mockToday = '2027-01-01';
jest.mock('@/lib/dates', () => ({ ...jest.requireActual('@/lib/dates'), today: () => mockToday }));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const { useRegisterPipAction } = require('@/components/nav/pip-action') as { useRegisterPipAction: jest.Mock };
const PlanTab = require('@/app/(app)/trip/[id]/(tabs)/plan').default as () => React.JSX.Element;

function item(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'p1',
    trip_id: TRIP_ID,
    day: '2027-03-11',
    start_time: '09:00:00',
    title: 'Breakfast',
    note: null,
    created_by: MEMBER,
    created_at: '2027-02-01T00:00:00Z',
    updated_at: '2027-02-01T00:00:00Z',
    ...overrides,
  };
}

// Thursday 11 March to Monday 15 March 2027.
const locked = () => trip({ status: 'locked', locked_start: '2027-03-11', locked_end: '2027-03-15' });

describe('Plan tab', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(MEMBER);
    mockToday = '2027-01-01';
    mockState = tripState(locked());
    mockItems = [
      item({ id: 'p1', title: 'Sunset at the fort', start_time: '18:15:00', note: 'Walk up', created_by: ORGANISER }),
      item({ id: 'p2', title: 'Breakfast at Artjuna', start_time: '09:00:00', note: 'Anjuna' }),
      item({ id: 'p3', day: '2027-03-12', title: 'Scooters', start_time: '11:30:00', created_by: null }),
    ];
  });

  it('shows the Hmm state with a Vote button when the trip has no dates', async () => {
    mockState = tripState(trip());
    await render(<PlanTab />);
    expect(screen.getByText('The plan opens once the trip has dates. Pick them in Vote.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Vote' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'dates' } });
  });

  it('shows the header, the day strip states and the first day by default', async () => {
    await render(<PlanTab />);
    expect(screen.getByText('Goa in March · 2 of 5 days planned')).toBeTruthy();
    expect(screen.getByText('The plan')).toBeTruthy();

    const thu = screen.getByRole('button', { name: 'Thursday, March 11, 2 plans' });
    expect(thu).toBeSelected();
    expect(screen.getByRole('button', { name: 'Friday, March 12, 1 plan' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Saturday, March 13, 0 plans' })).toBeTruthy();

    expect(screen.getByText('Anjuna · added by you')).toBeTruthy();
    expect(screen.getByText('Walk up · added by Aarav')).toBeTruthy();
    // Sorted by time.
    const titles = screen.getAllByText(/Breakfast at Artjuna|Sunset at the fort/).map((t) => t.props.children);
    expect(titles).toEqual(['Breakfast at Artjuna', 'Sunset at the fort']);
    expect(screen.getByRole('button', { name: 'Add to Thursday' })).toBeTruthy();
    expect(screen.getByText(/Saturday, Sunday and 1 more are wide open\. Dashed days have nothing planned yet\./)).toBeTruthy();
  });

  it('lets the author edit their plan, and shows other people’s plans read-only', async () => {
    await render(<PlanTab />);
    await fireEvent.press(screen.getByRole('button', { name: '9:00, Breakfast at Artjuna, Anjuna · added by you' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan-item', params: { id: TRIP_ID, item: 'p2' } });
    expect(screen.queryByRole('button', { name: /Sunset at the fort/ })).toBeNull();
    expect(screen.getByLabelText('18:15, Sunset at the fort, Walk up · added by Aarav')).toBeTruthy();
  });

  it('lets an organiser edit anyone’s plan', async () => {
    mockSession = sessionFor(ORGANISER);
    await render(<PlanTab />);
    await fireEvent.press(screen.getByRole('button', { name: '9:00, Breakfast at Artjuna, Anjuna · added by Meera' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan-item', params: { id: TRIP_ID, item: 'p2' } });
  });

  it('switches days, shows an empty day and adds to it', async () => {
    await render(<PlanTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Friday, March 12, 1 plan' }));
    expect(screen.getByText('Added by Someone')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Saturday, March 13, 0 plans' }));
    expect(screen.getByText('Nothing planned for Saturday yet.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to Saturday' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan-item', params: { id: TRIP_ID, day: '2027-03-13' } });
  });

  it('starts on today during the trip and registers the Pip action for it', async () => {
    mockToday = '2027-03-14';
    await render(<PlanTab />);
    expect(screen.getByRole('button', { name: 'Sunday, March 14, 0 plans' })).toBeSelected();
    expect(useRegisterPipAction).toHaveBeenLastCalledWith('Add to Sunday', expect.any(Function));
    useRegisterPipAction.mock.lastCall[1]();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/plan-item', params: { id: TRIP_ID, day: '2027-03-14' } });
  });

  it('lists plans that are not on the new dates', async () => {
    mockItems = [...mockItems, item({ id: 'p9', day: '2027-03-20', title: 'Old plan' })];
    await render(<PlanTab />);
    expect(screen.queryByText('Old plan')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "1 plan isn't on the new dates" }));
    expect(screen.getByText('Old plan')).toBeTruthy();
  });

  it('works for a planning trip with fixed dates, and says when every day is planned', async () => {
    mockState = tripState(trip({ fixed_start: '2027-03-11', fixed_end: '2027-03-12' }));
    await render(<PlanTab />);
    expect(screen.getByText('Goa in March · 2 of 2 days planned')).toBeTruthy();
    expect(screen.getByText(/Every day has something planned\./)).toBeTruthy();
    expect(screen.queryByText(/Dashed days/)).toBeNull();
  });

  it('names days by number on long trips', async () => {
    mockState = tripState(trip({ status: 'locked', locked_start: '2027-03-11', locked_end: '2027-03-18' }));
    await render(<PlanTab />);
    expect(screen.getByText('Goa in March · 2 of 8 days planned')).toBeTruthy();
    expect(screen.getByText(/Day 3, 4 and 4 more are wide open\./)).toBeTruthy();
  });

  it('listens for plan, trip and member changes', async () => {
    await render(<PlanTab />);
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function), ['itinerary_items', 'trips', 'trip_members']);
    useTripLive.mock.lastCall[1]();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockRefreshPlan).toHaveBeenCalled();
  });
});
