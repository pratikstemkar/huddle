import { act, renderHook } from '@testing-library/react-native';

import {
  balanceNote,
  computeBalances,
  deleteExpense,
  equalShares,
  myLines,
  recordSettlement,
  saveExpense,
  simplifyDebts,
  splitFeed,
  undoSettlement,
  useSplit,
  type Expense,
  type Settlement,
} from '@/lib/split';
import { queriesFor, queueResult, rpcCalls } from '../../test-utils/supabase-mock';

const A = '11111111-1111-1111-1111-111111111111';
const M = '22222222-2222-2222-2222-222222222222';
const K = '33333333-3333-3333-3333-333333333333';
const Z = '44444444-4444-4444-4444-444444444444';

let seq = 0;
function expense(paid_by: string | null, shares: [string | null, number][], overrides: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    trip_id: 't1',
    title: 'Thing',
    category: 'other',
    amount_minor: shares.reduce((n, [, s]) => n + s, 0),
    paid_by,
    created_by: paid_by,
    created_at: `2027-01-0${seq % 9}T00:00:00Z`,
    shares: shares.map(([user_id, share_minor]) => ({ user_id, share_minor })),
    ...overrides,
  };
}

function settlement(from_user: string | null, to_user: string | null, amount_minor: number, overrides: Partial<Settlement> = {}): Settlement {
  seq += 1;
  return { id: `s${seq}`, trip_id: 't1', from_user, to_user, amount_minor, created_by: from_user, created_at: '2027-01-05T00:00:00Z', ...overrides };
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

/** The Pondy seed data, with shares exactly as save_expense() writes them. */
const pondyExpenses = [
  expense(A, [
    [A, 300000],
    [M, 300000],
    [K, 300000],
    [Z, 300000],
  ]),
  expense(M, [
    [A, 75000],
    [M, 75000],
    [K, 75000],
    [Z, 75000],
  ]),
  expense(K, [
    [A, 113334],
    [K, 113333],
    [Z, 113333],
  ]),
];
const pondySettlements = [settlement(Z, M, 50000)];

/** The `trip_stats.my_net_minor` formula from the trip_stats migration, written out in TypeScript. */
function sqlMyNet(me: string, expenses: Expense[], settlements: Settlement[]) {
  let net = 0;
  for (const e of expenses) {
    for (const s of e.shares) {
      if (e.paid_by === me && s.user_id !== null && s.user_id !== me) net += s.share_minor;
      if (s.user_id === me && e.paid_by !== null && e.paid_by !== me) net -= s.share_minor;
    }
  }
  for (const x of settlements) {
    if (x.from_user === me && x.to_user !== null) net += x.amount_minor;
    if (x.to_user === me && x.from_user !== null) net -= x.amount_minor;
  }
  return net;
}

describe('equalShares', () => {
  it('splits evenly when it divides', () => {
    expect(Object.fromEntries(equalShares(1200, [A, M, K]))).toEqual({ [A]: 400, [M]: 400, [K]: 400 });
  });

  it('gives the remainder one unit each to the first people by user id, like the database', () => {
    expect(Object.fromEntries(equalShares(340000, [Z, K, A]))).toEqual({ [A]: 113334, [K]: 113333, [Z]: 113333 });
    expect(Object.fromEntries(equalShares(10, [K, M, A, Z]))).toEqual({ [A]: 3, [M]: 3, [K]: 2, [Z]: 2 });
  });

  it('always adds up to the amount', () => {
    for (const amount of [1, 7, 99, 100, 101, 123457]) {
      for (const people of [[A], [A, M], [A, M, K], [A, M, K, Z]]) {
        expect(sum(equalShares(amount, people))).toBe(amount);
      }
    }
  });

  it('ignores repeated people and gives zero shares when the amount is smaller than the group', () => {
    expect(Object.fromEntries(equalShares(2, [A, A, M, K]))).toEqual({ [A]: 1, [M]: 1, [K]: 0 });
  });

  it('is empty with nobody to split with', () => {
    expect(equalShares(100, []).size).toBe(0);
  });
});

describe('computeBalances', () => {
  it('counts shares against their person and for the payer', () => {
    const net = computeBalances([expense(A, [[A, 500], [M, 500]])], []);
    expect(Object.fromEntries(net)).toEqual({ [A]: 500, [M]: -500 });
  });

  it('handles a payer who is not in the split', () => {
    const net = computeBalances([expense(A, [[M, 300], [K, 300]])], []);
    expect(Object.fromEntries(net)).toEqual({ [A]: 600, [M]: -300, [K]: -300 });
  });

  it('counts a settlement for the person who paid it back', () => {
    const net = computeBalances([expense(A, [[A, 500], [M, 500]])], [settlement(M, A, 200)]);
    expect(Object.fromEntries(net)).toEqual({ [A]: 300, [M]: -300 });
  });

  it('skips anything involving a deleted account, and still sums to zero', () => {
    const net = computeBalances(
      [expense(null, [[A, 500], [M, 500]]), expense(A, [[A, 100], [null, 100], [M, 100]])],
      [settlement(null, A, 50), settlement(M, null, 70), settlement(M, A, 30)],
    );
    expect(Object.fromEntries(net)).toEqual({ [A]: 70, [M]: -70 });
    expect(sum(net)).toBe(0);
  });

  it('matches the Pondy seed, and the trip_stats view, for everyone', () => {
    const net = computeBalances(pondyExpenses, pondySettlements);
    expect(Object.fromEntries(net)).toEqual({ [A]: 711666, [M]: -125000, [K]: -148333, [Z]: -438333 });
    expect(sum(net)).toBe(0);
    for (const u of [A, M, K, Z]) expect(sqlMyNet(u, pondyExpenses, pondySettlements)).toBe(net.get(u));
  });
});

describe('simplifyDebts', () => {
  it('has the largest debtor pay the largest creditor first', () => {
    const net = new Map([
      [A, 711666],
      [M, -125000],
      [K, -148333],
      [Z, -438333],
    ]);
    expect(simplifyDebts(net)).toEqual([
      { from: Z, to: A, amount_minor: 438333 },
      { from: K, to: A, amount_minor: 148333 },
      { from: M, to: A, amount_minor: 125000 },
    ]);
  });

  it('breaks ties by user id', () => {
    const net = new Map([
      [M, 100],
      [A, 100],
      [Z, -100],
      [K, -100],
    ]);
    expect(simplifyDebts(net)).toEqual([
      { from: K, to: A, amount_minor: 100 },
      { from: Z, to: M, amount_minor: 100 },
    ]);
  });

  it('is empty when everyone is square', () => {
    expect(simplifyDebts(new Map([[A, 0], [M, 0]]))).toEqual([]);
    expect(simplifyDebts(new Map())).toEqual([]);
  });

  it('settles everyone, in at most n - 1 payments, the same way every time', () => {
    // A small pseudo-random generator so the cases are varied but repeatable.
    let x = 42;
    const rand = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    const people = [A, M, K, Z, 'u5', 'u6', 'u7'];
    for (let round = 0; round < 50; round++) {
      const expenses = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => {
        const payer = people[Math.floor(rand() * people.length)];
        const split = people.filter(() => rand() < 0.6);
        const shares = equalShares(1 + Math.floor(rand() * 100000), split.length ? split : [payer]);
        return expense(payer, [...shares]);
      });
      const net = computeBalances(expenses, []);
      const transfers = simplifyDebts(net);
      const nonZero = [...net.values()].filter((n) => n !== 0).length;
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
      const after = new Map(net);
      for (const t of transfers) {
        expect(t.amount_minor).toBeGreaterThan(0);
        after.set(t.from, after.get(t.from)! + t.amount_minor);
        after.set(t.to, after.get(t.to)! - t.amount_minor);
      }
      expect([...after.values()].every((n) => n === 0)).toBe(true);
      // Deterministic, whatever order the balances come in.
      expect(simplifyDebts(new Map([...net].reverse()))).toEqual(transfers);
    }
  });
});

describe('myLines', () => {
  it("splits the payments into mine owed and mine to pay, and my lines sum to my net", () => {
    // The design: Arjun owes me ₹1,850, I owe Zoe ₹600, so "You're owed ₹1,250".
    const transfers = [
      { from: 'arjun', to: 'me', amount_minor: 185000 },
      { from: 'me', to: 'zoe', amount_minor: 60000 },
      { from: 'lena', to: 'zoe', amount_minor: 1000 },
    ];
    expect(myLines(transfers, 'me')).toEqual({
      owedToMe: [transfers[0]],
      iOwe: [transfers[1]],
      net: 125000,
    });
  });

  it('agrees with computeBalances for everyone after simplifying', () => {
    const net = computeBalances(pondyExpenses, pondySettlements);
    const transfers = simplifyDebts(net);
    for (const u of [A, M, K, Z]) expect(myLines(transfers, u).net).toBe(net.get(u));
  });

  it('is square with no payments', () => {
    expect(myLines([], 'me')).toEqual({ owedToMe: [], iOwe: [], net: 0 });
  });
});

describe('splitFeed', () => {
  it('puts expenses and settlements together, newest first', () => {
    const e1 = expense(A, [[M, 1]], { created_at: '2027-01-01T00:00:00Z' });
    const e2 = expense(A, [[M, 1]], { created_at: '2027-01-03T00:00:00Z' });
    const s1 = settlement(M, A, 1, { created_at: '2027-01-02T00:00:00Z' });
    expect(splitFeed([e1, e2], [s1]).map((f) => f.kind + ':' + (f.kind === 'expense' ? f.expense.id : f.settlement.id))).toEqual([
      `expense:${e2.id}`,
      `settlement:${s1.id}`,
      `expense:${e1.id}`,
    ]);
  });
});

describe('balanceNote', () => {
  it('says what I still owe or am owed', () => {
    expect(balanceNote(-60000)).toBe("You still owe ₹600. It stays on the trip's Split.");
    expect(balanceNote(185000)).toBe("You are still owed ₹1,850. It stays on the trip's Split.");
  });

  it('names someone else', () => {
    expect(balanceNote(-60000, 'INR', 'Meera')).toBe("Meera still owes ₹600. It stays on the trip's Split.");
    expect(balanceNote(1000, 'INR', 'Meera')).toBe("Meera is still owed ₹10. It stays on the trip's Split.");
  });

  it('is null when square', () => {
    expect(balanceNote(0)).toBeNull();
  });
});

describe('useSplit', () => {
  it('loads expenses with their shares and settlements, and works out balances', async () => {
    queueResult('expenses', {
      data: [
        {
          id: 'e1',
          trip_id: 't1',
          title: 'Stay',
          category: 'stay',
          amount_minor: 1000,
          paid_by: 'me',
          created_by: 'me',
          created_at: '2027-01-02',
          expense_shares: [
            { user_id: 'me', share_minor: 500 },
            { user_id: 'zoe', share_minor: 500 },
          ],
        },
        { id: 'e2', trip_id: 't1', title: 'Snacks', category: 'food', amount_minor: 300, paid_by: 'zoe', created_by: 'zoe', created_at: '2027-01-01', expense_shares: null },
      ],
    });
    queueResult('settlements', { data: [{ id: 's1', trip_id: 't1', from_user: 'zoe', to_user: 'me', amount_minor: 100, created_by: 'zoe', created_at: '2027-01-03' }] });
    const { result } = await renderHook(() => useSplit('t1', 'me'));
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());

    expect(result.current.error).toBeNull();
    expect(result.current.expenses[0].shares).toEqual([
      { user_id: 'me', share_minor: 500 },
      { user_id: 'zoe', share_minor: 500 },
    ]);
    expect(result.current.expenses[1].shares).toEqual([]);
    expect(result.current.spent).toBe(1300);
    expect(Object.fromEntries(result.current.balances)).toEqual({ me: 400, zoe: -400 });
    expect(result.current.transfers).toEqual([{ from: 'zoe', to: 'me', amount_minor: 400 }]);
    expect(result.current.lines).toEqual({ owedToMe: [{ from: 'zoe', to: 'me', amount_minor: 400 }], iOwe: [], net: 400 });
    expect(queriesFor('expenses')[0].ops).toEqual([
      ['select', ['id, trip_id, title, category, amount_minor, paid_by, created_by, created_at, expense_shares(user_id, share_minor)']],
      ['eq', ['trip_id', 't1']],
      ['order', ['created_at', { ascending: false }]],
    ]);
    expect(queriesFor('settlements')[0].ops[1]).toEqual(['eq', ['trip_id', 't1']]);
  });

  it('has no lines without me', async () => {
    const { result } = await renderHook(() => useSplit('t1'));
    await act(() => result.current.refresh());
    expect(result.current.lines).toBeNull();
  });

  it('keeps the last data and shows an error when loading fails', async () => {
    queueResult('expenses', { data: [{ id: 'e1', amount_minor: 5, paid_by: 'a', expense_shares: [] }] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useSplit('t1', 'me'));
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.error).toBe("Couldn't load the costs. Check your connection and try again.");
    expect(result.current.loading).toBe(false);
  });

  it('does nothing without a trip', async () => {
    const { result } = await renderHook(() => useSplit(undefined));
    await act(() => result.current.refresh());
    expect(queriesFor('expenses')).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('saveExpense', () => {
  it('calls save_expense with a new expense', async () => {
    queueResult('rpc:save_expense', { data: 'e9' });
    await expect(
      saveExpense('t1', { title: '  Dinner ', category: 'food', amountMinor: 340000, paidBy: K, splitWith: [A, K, Z] }),
    ).resolves.toBe('e9');
    expect(rpcCalls).toEqual([
      {
        name: 'save_expense',
        args: { t: 't1', expense: null, title: 'Dinner', category: 'food', amount_minor: 340000, paid_by: K, split_with: [A, K, Z] },
      },
    ]);
  });

  it('passes the id when editing', async () => {
    await saveExpense('t1', { id: 'e1', title: 'Stay', category: 'stay', amountMinor: 1, paidBy: A, splitWith: [A] });
    expect((rpcCalls[0].args as { expense: string }).expense).toBe('e1');
  });

  it('throws the database error', async () => {
    queueResult('rpc:save_expense', { error: { message: 'Everyone in the split must be in the trip' } });
    await expect(saveExpense('t1', { title: 'x', category: 'other', amountMinor: 1, paidBy: A, splitWith: [A] })).rejects.toEqual({
      message: 'Everyone in the split must be in the trip',
    });
  });
});

describe('deleteExpense', () => {
  it('deletes the expense', async () => {
    queueResult('expenses', { data: [{ id: 'e1' }] });
    await deleteExpense('e1');
    expect(queriesFor('expenses')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['id', 'e1']],
      ['select', ['id']],
    ]);
  });

  it('throws when RLS deleted nothing', async () => {
    queueResult('expenses', { data: [] });
    await expect(deleteExpense('e1')).rejects.toThrow('Not deleted');
  });

  it('throws the database error', async () => {
    queueResult('expenses', { error: { message: 'offline' } });
    await expect(deleteExpense('e1')).rejects.toEqual({ message: 'offline' });
  });
});

describe('settlements', () => {
  it('records who paid whom', async () => {
    await recordSettlement('t1', Z, M, 50000);
    expect(queriesFor('settlements')[0].ops).toEqual([['insert', [{ trip_id: 't1', from_user: Z, to_user: M, amount_minor: 50000 }]]]);
  });

  it('throws when recording fails', async () => {
    queueResult('settlements', { error: { message: 'new row violates row-level security policy' } });
    await expect(recordSettlement('t1', Z, M, 1)).rejects.toEqual({ message: 'new row violates row-level security policy' });
  });

  it('undoes my settlement', async () => {
    queueResult('settlements', { data: [{ id: 's1' }] });
    await undoSettlement('s1');
    expect(queriesFor('settlements')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['id', 's1']],
      ['select', ['id']],
    ]);
  });

  it("throws when undoing someone else's settlement", async () => {
    queueResult('settlements', { data: [] });
    await expect(undoSettlement('s1')).rejects.toThrow('Not deleted');
  });
});
