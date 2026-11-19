import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { mockConfirm } from '../../test-utils/ui-mocks';

import { PipActionProvider, usePipAction } from '@/components/nav/pip-action';
import type { TripMember } from '@/lib/trips';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, members, sessionFor, trip, tripState } from '../../test-utils/fixtures';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/lib/realtime', () => ({ useTripLive: jest.fn() }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

const { useTripLive } = require('@/lib/realtime') as { useTripLive: jest.Mock };
const SplitTab = require('@/app/(app)/trip/[id]/(tabs)/split').default as () => React.JSX.Element;

const ZOE = 'zoe-id';
const zoe: TripMember = { user_id: ZOE, role: 'member', display_name: 'Zoe Fernandes', avatar_url: null, avatar_color: null, joined_at: '2027-01-03T00:00:00Z' };

type Row = { id: string; title: string; amount: number; paidBy: string | null; by?: string; shares: [string | null, number][]; at: string; category?: string };
const expense = (r: Row) => ({
  id: r.id,
  trip_id: TRIP_ID,
  title: r.title,
  category: r.category ?? 'other',
  amount_minor: r.amount,
  paid_by: r.paidBy,
  created_by: r.by ?? r.paidBy,
  created_at: r.at,
  expense_shares: r.shares.map(([user_id, share_minor]) => ({ user_id, share_minor })),
});
const settlement = (id: string, from: string, to: string, amount: number, at: string, by = from) => ({
  id,
  trip_id: TRIP_ID,
  from_user: from,
  to_user: to,
  amount_minor: amount,
  created_by: by,
  created_at: at,
});

/** Villa: I paid ₹1,200 for the three of us, so Meera and Zoe owe me ₹400 each. */
const villa = expense({
  id: 'e1',
  title: 'Villa, 4 nights',
  category: 'stay',
  amount: 120000,
  paidBy: ORGANISER,
  shares: [
    [ORGANISER, 40000],
    [MEMBER, 40000],
    [ZOE, 40000],
  ],
  at: '2027-01-05T00:00:00Z',
});

function load(expenses: unknown[], settlements: unknown[] = []) {
  queueResult('expenses', { data: expenses });
  queueResult('settlements', { data: settlements });
}

async function renderTab() {
  await render(<SplitTab />);
  await screen.findByText('Split');
}

describe('Split tab', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip({ members: [...members, zoe] }));
  });

  it('shows what I am owed, my lines and the total spent', async () => {
    load([villa]);
    await renderTab();
    expect(await screen.findByText('Goa in March · ₹1,200 spent')).toBeTruthy();
    expect(screen.getByLabelText("You're owed ₹800")).toBeTruthy();
    expect(screen.getByLabelText('Meera owes you ₹400')).toBeTruthy();
    expect(screen.getByLabelText('Zoe owes you ₹400')).toBeTruthy();
    expect(screen.getByText('You paid · split 3 ways')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Settle up' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/settle', params: { id: TRIP_ID } });
  });

  it('shows what I owe', async () => {
    load([
      expense({
        id: 'e2',
        title: 'Scooter rental',
        category: 'travel',
        amount: 90000,
        paidBy: MEMBER,
        shares: [
          [ORGANISER, 30000],
          [MEMBER, 30000],
          [ZOE, 30000],
        ],
        at: '2027-01-06T00:00:00Z',
      }),
    ]);
    await renderTab();
    expect(await screen.findByLabelText('You owe ₹300')).toBeTruthy();
    expect(screen.getByLabelText('You owe Meera ₹300')).toBeTruthy();
    expect(screen.getByText('Meera paid · split 3 ways')).toBeTruthy();
  });

  it("says I'm all square with no Settle up button", async () => {
    load([villa], [settlement('s1', MEMBER, ORGANISER, 40000, '2027-01-07T00:00:00Z'), settlement('s2', ZOE, ORGANISER, 40000, '2027-01-08T00:00:00Z')]);
    await renderTab();
    expect(await screen.findByLabelText("You're all square ₹0")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Settle up' })).toBeNull();
  });

  it('lists expenses and settlements newest first with friendly subtitles', async () => {
    load(
      [
        villa,
        expense({ id: 'e3', title: 'Ice cream', amount: 20000, paidBy: MEMBER, shares: [[ZOE, 20000]], at: '2027-01-09T00:00:00Z' }),
        expense({ id: 'e4', title: 'Taxi', amount: 10000, paidBy: null, by: MEMBER, shares: [[MEMBER, 5000], [ORGANISER, 5000]], at: '2027-01-10T00:00:00Z' }),
        expense({ id: 'e5', title: 'Snacks', amount: 5000, paidBy: MEMBER, shares: [[ORGANISER, 5000]], at: '2027-01-04T00:00:00Z' }),
      ],
      [settlement('s1', MEMBER, ORGANISER, 10000, '2027-01-11T00:00:00Z')],
    );
    await renderTab();
    expect(await screen.findByText('Meera paid you')).toBeTruthy();
    expect(screen.getByText('settled up')).toBeTruthy();
    expect(screen.getByText('Someone paid · split 2 ways')).toBeTruthy();
    expect(screen.getByText('Meera paid · just Zoe')).toBeTruthy();
    expect(screen.getByText('Meera paid · just you')).toBeTruthy();
    const order = screen.getAllByText(/^(Meera paid you|Taxi|Ice cream|Villa, 4 nights|Snacks)$/).map((n) => n.props.children);
    expect(order).toEqual(['Meera paid you', 'Taxi', 'Ice cream', 'Villa, 4 nights', 'Snacks']);
  });

  it('opens an expense for editing when I added it or organise the trip', async () => {
    mockSession = sessionFor(MEMBER);
    load([villa, expense({ id: 'e6', title: 'Water', amount: 4000, paidBy: MEMBER, shares: [[MEMBER, 2000], [ZOE, 2000]], at: '2027-01-09T00:00:00Z' })]);
    await renderTab();
    await screen.findByText('Water');
    expect(screen.queryByRole('button', { name: /^Villa, 4 nights/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Water/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/expense', params: { id: TRIP_ID, expense: 'e6' } });
  });

  it('undoes my own settlement after confirming', async () => {
    load([villa], [settlement('s1', ORGANISER, MEMBER, 10000, '2027-01-11T00:00:00Z'), settlement('s2', ZOE, ORGANISER, 5000, '2027-01-12T00:00:00Z')]);
    await renderTab();
    await screen.findByText('You paid Meera');
    expect(screen.queryByRole('button', { name: /^Zoe paid you/ })).toBeNull();

    queueResult('settlements', { data: [{ id: 's1' }] });
    load([villa], []);
    await fireEvent.press(screen.getByRole('button', { name: /^You paid Meera/ }));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Undo this payment?' }));
    const del = queriesFor('settlements').find((q) => q.ops.some(([m]) => m === 'delete'));
    expect(del?.ops).toEqual(expect.arrayContaining([['eq', ['id', 's1']]]));
    expect(await screen.findByLabelText("You're owed ₹800")).toBeTruthy();
  });

  it('shows an error when undoing fails', async () => {
    load([villa], [settlement('s1', ORGANISER, MEMBER, 10000, '2027-01-11T00:00:00Z')]);
    await renderTab();
    await screen.findByText('You paid Meera');
    queueResult('settlements', { error: { message: 'nope' } });
    await fireEvent.press(screen.getByRole('button', { name: /^You paid Meera/ }));
    expect(await screen.findByText("Couldn't undo that payment. Check your connection and try again.")).toBeTruthy();
  });

  it('cheers once when a settlement brings me to zero', async () => {
    load([villa], [settlement('s1', MEMBER, ORGANISER, 40000, '2027-01-07T00:00:00Z')]);
    await renderTab();
    expect(await screen.findByLabelText("You're owed ₹400")).toBeTruthy();
    expect(screen.queryByTestId('pip-yay', { includeHiddenElements: true })).toBeNull();
    expect(useTripLive).toHaveBeenCalledWith(TRIP_ID, expect.any(Function), ['expenses', 'settlements', 'trip_members']);

    load([villa], [settlement('s1', MEMBER, ORGANISER, 40000, '2027-01-07T00:00:00Z'), settlement('s2', ZOE, ORGANISER, 40000, '2027-01-08T00:00:00Z')]);
    const onChange = useTripLive.mock.calls.at(-1)![1] as () => void;
    await act(async () => onChange());
    expect(await screen.findByLabelText("You're all square ₹0")).toBeTruthy();
    expect(screen.getByTestId('pip-yay', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the empty state and registers the Pip action', async () => {
    load([]);
    function PipProbe() {
      const { action } = usePipAction();
      return action ? <Text onPress={action.onPress}>{`Pip: ${action.label}`}</Text> : null;
    }
    await render(
      <PipActionProvider>
        <SplitTab />
        <PipProbe />
      </PipActionProvider>,
    );
    expect(await screen.findByText('No expenses yet. Add the first one and Huddle does the maths.')).toBeTruthy();
    expect(screen.getByTestId('pip-snooze', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Goa in March · ₹0 spent')).toBeTruthy();
    await fireEvent.press(screen.getByText('Pip: Add expense'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/expense', params: { id: TRIP_ID } });
    router.push.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/trip/[id]/expense', params: { id: TRIP_ID } });
  });

  it('works on a locked trip', async () => {
    mockState = tripState(trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-14', members: [...members, zoe] }));
    load([villa]);
    await renderTab();
    expect(await screen.findByLabelText("You're owed ₹800")).toBeTruthy();
  });

  it('explains a load failure and retries', async () => {
    queueResult('expenses', { error: { message: 'offline' } });
    await renderTab();
    expect(await screen.findByText("Couldn't load the costs. Check your connection and try again.")).toBeTruthy();
    load([villa]);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Villa, 4 nights')).toBeTruthy();
  });

  it('explains a missing trip', async () => {
    mockState = tripState(null);
    await render(<SplitTab />);
    expect(await screen.findByText("This trip doesn't exist, or you're not a member of it.")).toBeTruthy();
  });
});
