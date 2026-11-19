import { fireEvent, render, screen } from '@testing-library/react-native';
import { mockConfirm } from '../../test-utils/ui-mocks';

import type { TripMember } from '@/lib/trips';
import { router, setParams } from '../../test-utils/expo-router-mock';
import { MEMBER, ORGANISER, TRIP_ID, members, sessionFor, trip, tripState } from '../../test-utils/fixtures';
import { queriesFor, queueResult, rpcCalls } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));

let mockState: ReturnType<typeof tripState>;
jest.mock('@/lib/trips', () => ({ useTrip: () => mockState }));

const ExpenseSheet = require('@/app/(app)/trip/[id]/expense').default as () => React.JSX.Element;

const ZOE = 'zoe-id';
const zoe: TripMember = { user_id: ZOE, role: 'member', display_name: 'Zoe', avatar_url: null, avatar_color: null, joined_at: '2027-01-03T00:00:00Z' };

const dinner = {
  id: 'e1',
  trip_id: TRIP_ID,
  title: 'Dinner at Gunpowder',
  category: 'food',
  amount_minor: 340000,
  paid_by: MEMBER,
  created_by: MEMBER,
  created_at: '2027-01-05T00:00:00Z',
  expense_shares: [
    { user_id: ORGANISER, share_minor: 170000 },
    { user_id: MEMBER, share_minor: 170000 },
  ],
};

const chip = (name: string) => screen.getByRole('button', { name });
const selected = (name: string) => chip(name).props.accessibilityState?.selected;
const preview = () => screen.getByTestId('split-preview').props.children;

describe('Expense sheet: add', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID });
    mockSession = sessionFor(ORGANISER);
    mockState = tripState(trip({ members: [...members, zoe] }));
  });

  it('defaults to me paying and everyone in the split, with a live preview', async () => {
    await render(<ExpenseSheet />);
    expect(screen.getByText('₹')).toBeTruthy();
    expect(selected('Paid by You')).toBe(true);
    expect(selected('Paid by Meera')).toBe(false);
    for (const name of ['Split with You', 'Split with Meera', 'Split with Zoe']) expect(selected(name)).toBe(true);
    expect(preview()).toBe('split 3 ways');

    await fireEvent.changeText(screen.getByLabelText('Amount'), '1,200');
    expect(preview()).toBe('split 3 ways · ₹400 each');
    await fireEvent.press(chip('Split with Zoe'));
    expect(selected('Split with Zoe')).toBe(false);
    expect(preview()).toBe('split 2 ways · ₹600 each');
    await fireEvent.press(chip('Split with Meera'));
    expect(preview()).toBe('just you · ₹1,200');
  });

  it('shows uneven shares as a range', async () => {
    await render(<ExpenseSheet />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    expect(preview()).toBe('split 3 ways · ₹333.33–₹333.34 each');
  });

  it('saves through save_expense and closes', async () => {
    queueResult('rpc:save_expense', { data: 'new-id' });
    await render(<ExpenseSheet />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '1,200.50');
    await fireEvent.changeText(screen.getByLabelText('What for'), '  Dinner  ');
    await fireEvent.press(chip('Food'));
    await fireEvent.press(chip('Paid by Meera'));
    await fireEvent.press(chip('Split with Zoe'));
    await fireEvent.press(chip('Save expense'));
    expect(rpcCalls).toEqual([
      {
        name: 'save_expense',
        args: { t: TRIP_ID, expense: null, title: 'Dinner', category: 'food', amount_minor: 120050, paid_by: MEMBER, split_with: [ORGANISER, MEMBER] },
      },
    ]);
    expect(router.back).toHaveBeenCalled();
  });

  it('explains what is missing', async () => {
    await render(<ExpenseSheet />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.345');
    for (const name of ['Split with You', 'Split with Meera', 'Split with Zoe']) await fireEvent.press(chip(name));
    expect(preview()).toBe('Pick who’s in the split');
    await fireEvent.press(chip('Save expense'));
    expect(screen.getByText('Enter an amount, like 1,250.')).toBeTruthy();
    expect(screen.getByText('Say what it was for.')).toBeTruthy();
    expect(screen.getByText('Pick at least one person to split with.')).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '12');
    expect(screen.queryByText('Enter an amount, like 1,250.')).toBeNull();
  });

  it('turns a server refusal into a friendly message', async () => {
    queueResult('rpc:save_expense', { error: { message: 'Everyone in the split must be in the trip' } });
    await render(<ExpenseSheet />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '300');
    await fireEvent.changeText(screen.getByLabelText('What for'), 'Snacks');
    await fireEvent.press(chip('Save expense'));
    expect(await screen.findByText('Someone in the split has left the trip. Untick them and try again.')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('falls back to a connection message', async () => {
    queueResult('rpc:save_expense', { error: { message: 'fetch failed' } });
    await render(<ExpenseSheet />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '300');
    await fireEvent.changeText(screen.getByLabelText('What for'), 'Snacks');
    await fireEvent.press(chip('Save expense'));
    expect(await screen.findByText("Couldn't save the expense. Check your connection and try again.")).toBeTruthy();
  });

  it('uses the trip currency symbol', async () => {
    mockState = tripState(trip({ currency: 'USD', members: [...members, zoe] }));
    await render(<ExpenseSheet />);
    expect(screen.getByText('$')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Amount'), '30');
    expect(preview()).toBe('split 3 ways · $10 each');
  });

  it('has no Delete when adding', async () => {
    await render(<ExpenseSheet />);
    expect(screen.queryByRole('button', { name: 'Delete expense' })).toBeNull();
  });
});

describe('Expense sheet: edit', () => {
  beforeEach(() => {
    setParams({ id: TRIP_ID, expense: 'e1' });
    mockSession = sessionFor(MEMBER);
    mockState = tripState(trip({ members: [...members, zoe] }));
    queueResult('expenses', { data: [dinner] });
  });

  it('fills in the expense and saves it in place', async () => {
    queueResult('rpc:save_expense', { data: 'e1' });
    await render(<ExpenseSheet />);
    expect(await screen.findByText('Edit expense')).toBeTruthy();
    expect(screen.getByLabelText('Amount').props.value).toBe('3400');
    expect(screen.getByLabelText('What for').props.value).toBe('Dinner at Gunpowder');
    expect(selected('Food')).toBe(true);
    expect(selected('Paid by You')).toBe(true);
    expect(selected('Split with Zoe')).toBe(false);
    expect(preview()).toBe('split 2 ways · ₹1,700 each');
    await fireEvent.press(chip('Split with Zoe'));
    await fireEvent.press(chip('Save expense'));
    expect(rpcCalls[0].args).toEqual(
      expect.objectContaining({ expense: 'e1', amount_minor: 340000, paid_by: MEMBER, split_with: [ORGANISER, MEMBER, ZOE] }),
    );
  });

  it('deletes after confirming', async () => {
    await render(<ExpenseSheet />);
    queueResult('expenses', { data: [{ id: 'e1' }] });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete expense' }));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete this expense?' }));
    const del = queriesFor('expenses').find((q) => q.ops.some(([m]) => m === 'delete'));
    expect(del?.ops).toEqual(expect.arrayContaining([['eq', ['id', 'e1']]]));
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps the expense when Delete is cancelled', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    await render(<ExpenseSheet />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete expense' }));
    expect(queriesFor('expenses').some((q) => q.ops.some(([m]) => m === 'delete'))).toBe(false);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('lets an organiser edit anyone’s expense', async () => {
    mockSession = sessionFor(ORGANISER);
    await render(<ExpenseSheet />);
    expect(await screen.findByRole('button', { name: 'Save expense' })).toBeTruthy();
    expect(selected('Paid by Meera')).toBe(true);
  });

  it('stops other members editing', async () => {
    mockSession = sessionFor(ZOE);
    await render(<ExpenseSheet />);
    expect(await screen.findByText('You can only edit expenses you added.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save expense' })).toBeNull();
  });

  it('explains a deleted expense', async () => {
    setParams({ id: TRIP_ID, expense: 'gone' });
    await render(<ExpenseSheet />);
    expect(await screen.findByText("This expense isn't here any more. Someone may have deleted it.")).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(router.back).toHaveBeenCalled();
  });
});
