import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import { PipActionProvider, usePipAction, type PipAction } from '@/components/nav/pip-action';
import { formatDay, formatRange, formatTripDates } from '@/lib/dates';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, destination, sessionFor, trip, tripState } from '../../test-utils/fixtures';

jest.mock('expo-router', () => ({
  ...require('../../test-utils/expo-router-mock'),
  Redirect: ({ href }: { href: unknown }) => {
    mockRedirects.push(href);
    return null;
  },
}));

const mockRedirects: unknown[] = [];

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
const VoteTab = require('@/app/(app)/trip/[id]/(tabs)/vote').default as () => React.JSX.Element;
const DaysRedirect = require('@/app/(app)/trip/[id]/days').default as () => React.JSX.Element;
const PlacesRedirect = require('@/app/(app)/trip/[id]/places').default as () => React.JSX.Element;

// Fixed "today" so the calendar shows the same months every run.
const TODAY = new Date(2027, 2, 10, 12);
const long = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });

const seenAction = jest.fn<void, [PipAction | null]>();
const pip = (): PipAction | null => seenAction.mock.calls.at(-1)?.[0] ?? null;
function PipSpy() {
  const { action } = usePipAction();
  useEffect(() => seenAction(action));
  return null;
}

async function renderVote(seg?: 'places' | 'dates') {
  setParams({ id: TRIP_ID, seg });
  await render(
    <PipActionProvider>
      <VoteTab />
      <PipSpy />
    </PipActionProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] });
  jest.setSystemTime(TODAY);
  mockRedirects.length = 0;
  mockSession = sessionFor(ORGANISER);
  mockState = tripState(trip());
  mockAv = { myDays: new Set(), counts: new Map(), who: new Map(), loading: false, error: null, refresh: jest.fn(), setDay: jest.fn() };
  mockDest = { list: [], loading: false, error: null, refresh: jest.fn(), toggleVote: jest.fn(), remove: jest.fn() };
});

afterEach(() => jest.useRealTimers());

describe('Vote tab', () => {
  it('opens on Places by default and switches to Dates', async () => {
    await renderVote();
    expect(screen.getByRole('tab', { name: 'Places' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Where should we go?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Dates' }));
    expect(screen.getByText('When can we go?')).toBeTruthy();
  });

  it('opens on Dates from the seg param', async () => {
    await renderVote('dates');
    expect(screen.getByRole('tab', { name: 'Dates' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('When can we go?')).toBeTruthy();
  });

  it('follows a new seg param while open', async () => {
    await renderVote('places');
    setParams({ id: TRIP_ID, seg: 'dates' });
    await screen.rerender(
      <PipActionProvider>
        <VoteTab />
      </PipActionProvider>,
    );
    expect(screen.getByText('When can we go?')).toBeTruthy();
  });

  it('shows Pip while the trip loads', async () => {
    mockState = tripState(null, { loading: true });
    await renderVote();
    expect(screen.getByLabelText('Loading trip')).toBeTruthy();
  });

  it.each([
    [null, 'Trip not found', "This trip doesn't exist, or you're not a member of it."],
    ['Offline', 'Something went wrong', 'Offline'],
  ])('explains a missing trip (error %p)', async (error, title, body) => {
    mockState = tripState(null, { error });
    await renderVote();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
  });

  it('redirects the old days and places routes to the tab', async () => {
    setParams({ id: TRIP_ID });
    await render(<DaysRedirect />);
    await render(<PlacesRedirect />);
    expect(mockRedirects).toEqual([
      { pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'dates' } },
      { pathname: '/trip/[id]/vote', params: { id: TRIP_ID, seg: 'places' } },
    ]);
  });
});

describe('Places panel', () => {
  it('loads on focus and live-reloads with the trip', async () => {
    await renderVote();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockDest.refresh).toHaveBeenCalled();
    mockDest.refresh.mockClear();
    mockState.refresh.mockClear();
    useTripLive.mock.calls[0][1]();
    expect(mockDest.refresh).toHaveBeenCalled();
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('shows Pip while the places load', async () => {
    mockDest.loading = true;
    await renderVote();
    expect(screen.getByLabelText('Loading places')).toBeTruthy();
  });

  it('shows the empty state and opens Suggest from the dashed button and from Pip', async () => {
    await renderVote();
    expect(screen.getByText('No places yet')).toBeTruthy();
    expect(screen.getByText('Suggest somewhere to go, then everyone can vote.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Suggest a place' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/suggest', params: { id: TRIP_ID } });
    router.push.mockClear();
    expect(pip()?.label).toBe('Suggest a place');
    await act(async () => pip()!.onPress());
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/suggest', params: { id: TRIP_ID } });
  });

  it('counts voters in the kicker, marks the leader and tells who is left to vote', async () => {
    mockDest.list = [
      destination({ id: 'd1', title: 'Palolem', created_by: MEMBER, voters: [ORGANISER], voteCount: 1, iVoted: true }),
      destination({ id: 'd2', title: 'Hampi', created_by: ORGANISER, note: 'Boulders' }),
    ];
    await renderVote();
    expect(screen.getByText('Goa in March · 1 of 2 voted')).toBeTruthy();
    expect(screen.getAllByText('Leading')).toHaveLength(1);
    expect(screen.getByText('Suggested by Meera')).toBeTruthy();
    expect(screen.getByText('Suggested by you · Boulders')).toBeTruthy();
    expect(screen.getByText(/Back as many places as you like\. Meera is the only one left to vote\./)).toBeTruthy();
  });

  it.each([
    [[ORGANISER, MEMBER], 'Everyone has voted.'],
    [[MEMBER], "You're the only one left to vote."],
    [[], '2 still to vote.'],
  ])('says who still has to vote (voters %p)', async (voters, tail) => {
    mockDest.list = [destination({ voters, voteCount: voters.length })];
    await renderVote();
    expect(screen.getByText(new RegExp(`Back as many places as you like\\. ${tail.replace('.', '\\.')}`))).toBeTruthy();
  });

  it('votes, and lets the organiser remove any place', async () => {
    mockDest.list = [destination({ id: 'd1', title: 'Palolem', created_by: MEMBER })];
    await renderVote();
    await fireEvent.press(screen.getByRole('button', { name: 'Vote for Palolem' }));
    expect(mockDest.toggleVote).toHaveBeenCalledWith('d1');
    await fireEvent.press(screen.getByRole('button', { name: 'Palolem, 0 votes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Palolem' }));
    expect(mockDest.remove).toHaveBeenCalledWith('d1');
  });

  it('lets members remove only their own places', async () => {
    mockSession = sessionFor(MEMBER);
    mockDest.list = [destination({ id: 'd1', title: 'Mine', created_by: MEMBER }), destination({ id: 'd2', title: 'Theirs', created_by: ORGANISER })];
    await renderVote();
    await fireEvent.press(screen.getByRole('button', { name: 'Mine, 0 votes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Theirs, 0 votes' }));
    expect(screen.getByRole('button', { name: 'Remove Mine' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Theirs' })).toBeNull();
  });

  it('is read-only once locked and says who won', async () => {
    mockState = tripState(trip({ status: 'locked', locked_destination_id: 'd2' }));
    mockDest.list = [destination({ id: 'd1', title: 'Palolem' }), destination({ id: 'd2', title: 'Hampi' })];
    await renderVote();
    expect(screen.queryByRole('button', { name: 'Suggest a place' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Vote for Palolem' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Palolem, 0 votes' }));
    expect(screen.queryByRole('button', { name: 'Remove Palolem' })).toBeNull();
    expect(screen.getByText(/Voting's closed\. Hampi won\./)).toBeTruthy();
    expect(pip()).toBeNull();
  });

  it('shows the places error', async () => {
    mockDest.error = "Couldn't save your vote. Check your connection and try again.";
    await renderVote();
    expect(screen.getByText("Couldn't save your vote. Check your connection and try again.")).toBeTruthy();
  });
});

describe('Dates panel', () => {
  it('loads on focus and live-reloads with the trip', async () => {
    await renderVote('dates');
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockAv.refresh).toHaveBeenCalled();
    mockState.refresh.mockClear();
    mockAv.refresh.mockClear();
    useTripLive.mock.calls[0][1]();
    expect(mockState.refresh).toHaveBeenCalled();
    expect(mockAv.refresh).toHaveBeenCalled();
  });

  it('shows Pip while the days load', async () => {
    mockAv.loading = true;
    await renderVote('dates');
    expect(screen.getByLabelText('Loading days')).toBeTruthy();
  });

  it('lets me mark days in My days mode', async () => {
    await renderVote('dates');
    expect(screen.getByText('Tap the days you could go, or press and drag across several.')).toBeTruthy();
    expect(screen.getByText('Nobody has marked a day yet.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(long('2027-03-15')));
    expect(mockAv.setDay).toHaveBeenCalledWith('2027-03-15', true);
  });

  it('counts me in the kicker as soon as I mark a day', async () => {
    mockState = tripState(trip({ availabilityCount: 1, iMarked: false }));
    mockAv.myDays = new Set(['2027-03-15']);
    await renderVote('dates');
    expect(screen.getByText('Goa in March · 2 of 2 marked')).toBeTruthy();
    expect(screen.getByText(/2 of 2 have marked their days\.$/)).toBeTruthy();
  });

  it('lists the best days, leader first, and says so in the Pip line', async () => {
    mockState = tripState(trip({ availabilityCount: 2, iMarked: true }));
    mockAv.myDays = new Set(['2027-03-15', '2027-03-16']);
    mockAv.counts = new Map([
      ['2027-03-15', 2],
      ['2027-03-16', 2],
    ]);
    await renderVote('dates');
    const range = formatRange('2027-03-15', '2027-03-16');
    expect(screen.getByText('Best days')).toBeTruthy();
    expect(screen.getByText(`${range} · 2 of 2 free`)).toBeTruthy();
    expect(screen.getByText('Leading')).toBeTruthy();
    expect(screen.getByText(`Pip says 2 of 2 have marked their days. Best so far: ${range}.`)).toBeTruthy();
  });

  it('says when no day suits two people', async () => {
    mockAv.counts = new Map([['2027-03-15', 1]]);
    await renderVote('dates');
    expect(screen.getByText('No day suits two or more people yet.')).toBeTruthy();
  });

  it('shows who is free on a day in Everyone mode, and Pip switches back to My days', async () => {
    mockAv.counts = new Map([['2027-03-15', 2]]);
    mockAv.who = new Map([['2027-03-15', [ORGANISER, MEMBER]]]);
    await renderVote('dates');
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

    expect(pip()?.label).toBe('Mark my days');
    await act(async () => pip()!.onPress());
    expect(screen.getByRole('tab', { name: 'My days' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByText(hint)).toBeNull();
  });

  it('shows only counts when the trip hides who marked what', async () => {
    mockState = tripState(trip({ show_who_marked: false }));
    // The database only returns my own rows; counts include everyone.
    mockAv.myDays = new Set(['2027-03-15']);
    mockAv.counts = new Map([['2027-03-15', 2]]);
    mockAv.who = new Map([['2027-03-15', [ORGANISER]]]);
    await renderVote('dates');
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
    await renderVote('dates');
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyone' }));
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, 1 of 2 free`));
    expect(screen.getByLabelText('Traveller')).toBeTruthy();
  });

  it('is read-only and shows everyone once locked', async () => {
    mockState = tripState(trip({ status: 'locked' }));
    await renderVote('dates');
    expect(screen.getByText('Locked in. Dates are set.')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'My days' })).toBeNull();
    expect(screen.getByLabelText('Darker means more people are free')).toBeTruthy();
    expect(screen.queryByText(/have marked their days/)).toBeNull();
    expect(pip()).toBeNull();
  });

  it('shows the set dates instead of the calendar, with a settings link for the organiser', async () => {
    mockState = tripState(trip({ fixed_start: '2027-04-10', fixed_end: '2027-04-14' }));
    await renderVote('dates');
    expect(screen.getByText('Dates are set')).toBeTruthy();
    expect(screen.getByText(formatTripDates('2027-04-10', '2027-04-14'))).toBeTruthy();
    expect(screen.getByText('Set by you')).toBeTruthy();
    expect(screen.queryByTestId('month-pager')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'My days' })).toBeNull();
    expect(pip()).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Change in settings' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/settings', params: { id: TRIP_ID } });
  });

  it('names the organiser of set dates for members, without the settings link', async () => {
    mockSession = sessionFor(MEMBER);
    mockState = tripState(trip({ fixed_start: '2027-04-10', fixed_end: '2027-04-14' }));
    await renderVote('dates');
    expect(screen.getByText('Set by Aarav')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Change in settings' })).toBeNull();
  });

  it('shows the availability error', async () => {
    mockAv.error = "Couldn't save that day. Check your connection and try again.";
    await renderVote('dates');
    expect(screen.getByText("Couldn't save that day. Check your connection and try again.")).toBeTruthy();
  });
});
