// Ready-made trips: the Explore grid, a destination's plans, one plan's days, and starting a trip from it.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { router, setParams } from '../../test-utils/expo-router-mock';
import { queueResult } from '../../test-utils/supabase-mock';
import { formatDay, fromDay, today, toDay } from '@/lib/dates';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('@/lib/catalog', () => ({
  ...jest.requireActual('@/lib/catalog'),
  createTripFromTemplate: jest.fn(),
  shiftPlan: jest.fn(),
}));
jest.mock('@/lib/trips', () => ({
  ...jest.requireActual('@/lib/trips'),
  createTrip: jest.fn(),
  updateTrip: jest.fn(),
}));
jest.mock('@/components/invite-panel', () => ({
  InvitePanel: ({ tripId, groupId }: { tripId: string; groupId: string | null }) => {
    const { Text: RNText } = jest.requireActual('react-native');
    return (
      <RNText>
        Invite panel for {tripId}
        {groupId ? ` in ${groupId}` : ''}
      </RNText>
    );
  },
}));

const { createTripFromTemplate, shiftPlan } = require('@/lib/catalog') as { createTripFromTemplate: jest.Mock; shiftPlan: jest.Mock };
const { createTrip, updateTrip } = require('@/lib/trips') as { createTrip: jest.Mock; updateTrip: jest.Mock };
const Explore = require('@/app/(app)/explore/index').default as () => React.JSX.Element;
const ExploreDestination = require('@/app/(app)/explore/[destination]').default as () => React.JSX.Element;
const ExplorePlan = require('@/app/(app)/explore/plan/[id]').default as () => React.JSX.Element;
const NewTrip = require('@/app/(app)/new-trip').default as () => React.JSX.Element;

const goa = {
  id: 'goa',
  name: 'Goa',
  country: 'India',
  region: 'india',
  tags: ['beach'],
  blurb: 'Beaches, shacks and sunsets.',
  cover_url: 'https://images.unsplash.com/photo-1',
  photo_credit: 'alexey turenkov',
  sort: 10,
};
const bali = { ...goa, id: 'bali', name: 'Bali', country: 'Indonesia', region: 'abroad', sort: 60 };
const manali = { ...goa, id: 'manali', name: 'Manali', tags: ['mountains'], sort: 40 };
const north = { id: 'goa-north', destination_id: 'goa', title: 'North Goa: beaches and nights out', summary: 'Baga and Anjuna.', nights: 4, pace: 'balanced', sort: 10 };
const items = [
  { id: 'i1', itinerary_id: 'goa-north', day_index: 0, start_time: '14:00:00', title: 'Check in near Baga', note: null },
  { id: 'i2', itinerary_id: 'goa-north', day_index: 1, start_time: '10:00:00', title: 'Fort Aguada', note: 'Go early' },
  { id: 'i3', itinerary_id: 'goa-north', day_index: 2, start_time: '11:00:00', title: 'Anjuna flea market', note: null },
];

function queuePlan() {
  queueResult('catalog_itineraries', { data: north });
  queueResult('catalog_itinerary_items', { data: items });
  queueResult('catalog_destinations', { data: goa });
}

const dayLabel = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
function nextMonth(d: number) {
  const t = fromDay(today());
  return toDay(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, d)));
}

describe('Explore', () => {
  beforeEach(() => {
    queueResult('catalog_destinations', { data: [goa, bali, manali] });
    queueResult('catalog_itineraries', {
      data: [
        { destination_id: 'goa', nights: 4 },
        { destination_id: 'goa', nights: 3 },
        { destination_id: 'bali', nights: 6 },
        { destination_id: 'manali', nights: 4 },
      ],
    });
  });

  it('lists destinations with how many plans each has', async () => {
    await render(<Explore />);
    expect(await screen.findByText('Where should we go?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Goa, India, 2 plans · 3–4 nights' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bali, Indonesia, 1 plan · 6 nights' })).toBeTruthy();
  });

  it('filters by region and tag', async () => {
    await render(<Explore />);
    await screen.findByText('Goa');
    await fireEvent.press(screen.getByRole('button', { name: 'Abroad' }));
    expect(screen.queryByText('Goa')).toBeNull();
    expect(screen.getByText('Bali')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mountains' }));
    expect(screen.getByText('Manali')).toBeTruthy();
    expect(screen.queryByText('Bali')).toBeNull();
  });

  it('opens a destination and keeps the group it started from', async () => {
    setParams({ group: 'g1' });
    await render(<Explore />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Goa, India, 2 plans · 3–4 nights' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explore/[destination]', params: { destination: 'goa', group: 'g1' } });
  });
});

describe('Explore failures', () => {
  it('offers a retry when the catalog fails to load', async () => {
    queueResult('catalog_destinations', { error: { message: 'offline' } });
    await render(<Explore />);
    expect(await screen.findByText("Couldn't load trip ideas. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Explore destination', () => {
  it("lists the destination's plans with their highlights and opens one", async () => {
    setParams({ destination: 'goa' });
    queueResult('catalog_destinations', { data: goa });
    queueResult('catalog_itineraries', { data: [north] });
    queueResult('catalog_itinerary_items', { data: items });
    await render(<ExploreDestination />);
    expect(await screen.findByText('Beaches, shacks and sunsets.')).toBeTruthy();
    expect(screen.getByText('Photo: alexey turenkov on Unsplash')).toBeTruthy();
    expect(screen.getByText('Fort Aguada')).toBeTruthy();
    expect(screen.getByText('Anjuna flea market')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'North Goa: beaches and nights out, 4 nights, 5 days, Balanced' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explore/plan/[id]', params: { id: 'goa-north' } });
  });

  it('says when the destination is gone', async () => {
    setParams({ destination: 'atlantis' });
    await render(<ExploreDestination />);
    expect(await screen.findByText("That place isn't in the list any more. Pick another one.")).toBeTruthy();
  });
});

describe('Explore plan', () => {
  it('shows the plan day by day and starts a trip from it', async () => {
    setParams({ id: 'goa-north', group: 'g1' });
    queuePlan();
    await render(<ExplorePlan />);
    expect(await screen.findByText('Goa, India')).toBeTruthy();
    expect(screen.getByText('Day 1')).toBeTruthy();
    expect(screen.getByText('Day 3')).toBeTruthy();
    expect(screen.getByLabelText('10:00, Fort Aguada, Go early')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use this plan' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/new-trip', params: { template: 'goa-north', group: 'g1' } });
  });
});

describe('New trip from a plan', () => {
  beforeEach(() => {
    setParams({ template: 'goa-north' });
    queuePlan();
  });

  it('suggests a name and only asks for the first day', async () => {
    await render(<NewTrip />);
    expect(await screen.findByText('North Goa: beaches and nights out')).toBeTruthy();
    expect(screen.getByLabelText('Trip name').props.value).toBe('Goa trip');
    expect(screen.getByText('When do you start?')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: "Let the group vote, Everyone marks the days they're free" })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(screen.getByText('Pick the first day of the trip.')).toBeTruthy();
    expect(createTripFromTemplate).not.toHaveBeenCalled();
  });

  it('creates the trip from the plan, then shows the invite step', async () => {
    createTripFromTemplate.mockResolvedValue('trip-7');
    await render(<NewTrip />);
    await screen.findByText('North Goa: beaches and nights out');
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(nextMonth(10)) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(createTripFromTemplate).toHaveBeenCalledWith({ itineraryId: 'goa-north', name: 'Goa trip', color: 'iris', start: nextMonth(10), groupId: null });
    expect(createTrip).not.toHaveBeenCalled();
    expect(await screen.findByText('Invite panel for trip-7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to the trip' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: 'trip-7' } });
  });

  it('moves the copied plan when they go back and pick another first day', async () => {
    createTripFromTemplate.mockResolvedValue('trip-7');
    updateTrip.mockResolvedValue(undefined);
    shiftPlan.mockResolvedValue(undefined);
    await render(<NewTrip />);
    await screen.findByText('North Goa: beaches and nights out');
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(nextMonth(10)) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    await screen.findByText('Invite panel for trip-7');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(nextMonth(20)) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(updateTrip).toHaveBeenCalledWith('trip-7', { name: 'Goa trip', color: 'iris', fixed_start: nextMonth(20), fixed_end: nextMonth(24) });
    expect(shiftPlan).toHaveBeenCalledWith('trip-7', 10);
    expect(createTripFromTemplate).toHaveBeenCalledTimes(1);
  });

  it('shows why creating failed', async () => {
    createTripFromTemplate.mockRejectedValue(new Error('That plan is no longer available. Pick another one.'));
    await render(<NewTrip />);
    await screen.findByText('North Goa: beaches and nights out');
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: dayLabel(nextMonth(10)) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: invite people' }));
    expect(await screen.findByText('That plan is no longer available. Pick another one.')).toBeTruthy();
  });

  it('goes back to the plan from Change', async () => {
    await render(<NewTrip />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change plan' }));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('New trip from scratch', () => {
  it('offers ready-made trips and keeps the group', async () => {
    setParams({ group: 'g1' });
    await render(<NewTrip />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not sure where? Browse ready-made trips' }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/explore', params: { group: 'g1' } });
  });

  it('says when the plan it was opened with is gone', async () => {
    setParams({ template: 'gone' });
    await render(<NewTrip />);
    expect(await screen.findByText("That plan isn't available any more. Pick another one.")).toBeTruthy();
  });
});
