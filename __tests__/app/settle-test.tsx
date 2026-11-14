import { fireEvent, render, screen } from '@testing-library/react-native';

import type { TripMember } from '@/lib/trips';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, members, sessionFor, trip, tripState } from '../../test-utils/fixtures';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

const SettleSheet = require('@/app/(app)/trip/[id]/settle').default as () => React.JSX.Element;

const ZOE = 'zoe-id';
const zoe: TripMember = { user_id: ZOE, role: 'member', display_name: 'Zoe', avatar_url: null, avatar_color: null, joined_at: '2027-01-03T00:00:00Z' };

const expense = (id: string, paidBy: string, shares: [string, number][]) => ({
  id,
  trip_id: TRIP_ID,
  title: id,
  category: 'other',
  amount_minor: shares.reduce((n, [, s]) => n + s, 0),
  paid_by: paidBy,
  created_by: paidBy,
  created_at: '2027-01-05T00:00:00Z',
  expense_shares: shares.map(([user_id, share_minor]) => ({ user_id, share_minor })),
});

/** Meera paid ₹1,200 for the two of us: I owe her ₹600. */
function loadOwe() {
  queueResult('expenses', {
    data: [
      expense('scooters', MEMBER, [
        [ORGANISER, 60000],
        [MEMBER, 60000],
      ]),
    ],
  });
  queueResult('settlements', { data: [] });
}

/** I paid for everyone: Zoe owes me ₹1,850 and Meera ₹400. */
function loadOwed() {
  queueResult('expenses', {
    data: [
      expense('villa', ORGANISER, [
        [ORGANISER, 185000],
        [ZOE, 185000],
        [MEMBER, 40000],
      ]),
    ],
  });
  queueResult('settlements', { data: [] });
}

const inserted = () => queriesFor('settlements').find((q) => q.ops.some(([m]) => m === 'insert'))?.ops.find(([m]) => m === 'insert')?.[1][0];

describe('Settle sheet', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip({ members: [...members, zoe] }));
  });

  it('shows one row per line, each defaulting to the full amount', async () => {
    loadOwed();
    await render(<SettleSheet />);
    expect(await screen.findByText('Zoe owes you')).toBeTruthy();
    expect(screen.getByText('Meera owes you')).toBeTruthy();
    expect(screen.getByLabelText('Amount, Zoe owes you').props.value).toBe('1850');
    expect(screen.getByLabelText('Amount, Meera owes you').props.value).toBe('400');
    expect(screen.getByRole('button', { name: 'Zoe paid me' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Meera paid me' })).toBeTruthy();
  });

  it('shows what I owe', async () => {
    loadOwe();
    await render(<SettleSheet />);
    expect(await screen.findByText('You owe Meera')).toBeTruthy();
    expect(screen.getByLabelText('Amount, You owe Meera').props.value).toBe('600');
  });

  it('records the full payment I made and closes', async () => {
    loadOwe();
    await render(<SettleSheet />);
    await fireEvent.press(await screen.findByRole('button', { name: 'I paid Meera' }));
    expect(inserted()).toEqual({ trip_id: TRIP_ID, from_user: ORGANISER, to_user: MEMBER, amount_minor: 60000 });
    expect(router.back).toHaveBeenCalled();
  });

  it('records a partial payment made to me', async () => {
    loadOwed();
    await render(<SettleSheet />);
    await fireEvent.changeText(await screen.findByLabelText('Amount, Zoe owes you'), '1,000');
    await fireEvent.press(screen.getByRole('button', { name: 'Zoe paid me' }));
    expect(inserted()).toEqual({ trip_id: TRIP_ID, from_user: ZOE, to_user: ORGANISER, amount_minor: 100000 });
  });

  it('never records more than is owed', async () => {
    loadOwe();
    await render(<SettleSheet />);
    await fireEvent.changeText(await screen.findByLabelText('Amount, You owe Meera'), '601');
    await fireEvent.press(screen.getByRole('button', { name: 'I paid Meera' }));
    expect(screen.getByText("That's more than you owe Meera. The most is ₹600.")).toBeTruthy();
    expect(inserted()).toBeUndefined();
  });

  it('never records more than someone owes me, or nonsense', async () => {
    loadOwed();
    await render(<SettleSheet />);
    await fireEvent.changeText(await screen.findByLabelText('Amount, Meera owes you'), '500');
    await fireEvent.press(screen.getByRole('button', { name: 'Meera paid me' }));
    expect(screen.getByText("That's more than Meera owes you. The most is ₹400.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Amount, Zoe owes you'), 'lots');
    await fireEvent.press(screen.getByRole('button', { name: 'Zoe paid me' }));
    expect(screen.getByText('Enter an amount, like 1850.')).toBeTruthy();
    expect(inserted()).toBeUndefined();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('shows an error when recording fails', async () => {
    loadOwe();
    await render(<SettleSheet />);
    queueResult('settlements', { error: { message: 'denied' } });
    await fireEvent.press(await screen.findByRole('button', { name: 'I paid Meera' }));
    expect(await screen.findByText("Couldn't record that payment. Check your connection and try again.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('says when there is nothing to settle', async () => {
    queueResult('expenses', { data: [] });
    queueResult('settlements', { data: [] });
    await render(<SettleSheet />);
    expect(await screen.findByText("You're all square. Nothing to settle.")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(router.back).toHaveBeenCalled();
  });
});
