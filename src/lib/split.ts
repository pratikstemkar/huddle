import { useCallback, useMemo, useState } from 'react';

import { formatMoney } from './money';
import { supabase } from './supabase';

export type Category = 'stay' | 'travel' | 'food' | 'other';
export const CATEGORIES: Category[] = ['stay', 'travel', 'food', 'other'];

export type Share = { user_id: string | null; share_minor: number };

export type Expense = {
  id: string;
  trip_id: string;
  title: string;
  category: Category;
  amount_minor: number;
  /** Null once the payer deletes their account. */
  paid_by: string | null;
  created_by: string | null;
  created_at: string;
  shares: Share[];
};

export type Settlement = {
  id: string;
  trip_id: string;
  from_user: string | null;
  to_user: string | null;
  amount_minor: number;
  created_by: string | null;
  created_at: string;
};

/** One payment that settles part of the group's debts: `from` pays `to`. */
export type Transfer = { from: string; to: string; amount_minor: number };

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * An equal split, the same way `save_expense()` does it: everyone gets amount / n, and the remainder
 * goes one unit each to the first people by user id. Used for the live preview in the expense sheet.
 */
export function equalShares(amount: number, userIds: string[]): Map<string, number> {
  const people = [...new Set(userIds)].sort(byId);
  const shares = new Map<string, number>();
  if (!people.length) return shares;
  const base = Math.floor(amount / people.length);
  const rem = amount - base * people.length;
  people.forEach((u, i) => shares.set(u, base + (i < rem ? 1 : 0)));
  return shares;
}

/**
 * Each person's balance: positive means the group owes them, negative means they owe the group.
 * A share counts against its person and for the payer; a settlement counts for the person who paid it
 * back and against the person who received it. Anything involving a deleted account (null) is skipped,
 * which writes off that pair's debt and keeps the total at zero.
 */
export function computeBalances(expenses: Expense[], settlements: Settlement[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (u: string, n: number) => net.set(u, (net.get(u) ?? 0) + n);
  for (const e of expenses) {
    if (!e.paid_by) continue;
    for (const s of e.shares) {
      if (!s.user_id || s.user_id === e.paid_by) continue;
      add(s.user_id, -s.share_minor);
      add(e.paid_by, s.share_minor);
    }
  }
  for (const x of settlements) {
    if (!x.from_user || !x.to_user) continue;
    add(x.from_user, x.amount_minor);
    add(x.to_user, -x.amount_minor);
  }
  return net;
}

/**
 * The fewest simple payments that settle everyone up: repeatedly the person who owes the most pays the
 * person owed the most (ties by user id), as much as the smaller of the two. At most n - 1 payments,
 * and always the same answer for the same balances.
 */
export function simplifyDebts(net: Map<string, number>): Transfer[] {
  const creditors = [...net].filter(([, n]) => n > 0).map(([u, n]) => ({ u, n }));
  const debtors = [...net].filter(([, n]) => n < 0).map(([u, n]) => ({ u, n: -n }));
  const largest = (list: { u: string; n: number }[]) =>
    list.reduce((best, x) => (x.n > best.n || (x.n === best.n && x.u < best.u) ? x : best));
  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    const d = largest(debtors);
    const c = largest(creditors);
    const amount = Math.min(d.n, c.n);
    out.push({ from: d.u, to: c.u, amount_minor: amount });
    d.n -= amount;
    c.n -= amount;
    if (d.n === 0) debtors.splice(debtors.indexOf(d), 1);
    if (c.n === 0) creditors.splice(creditors.indexOf(c), 1);
  }
  return out;
}

/** The payments that involve me, and my net (what I'm owed minus what I owe). */
export function myLines(transfers: Transfer[], me: string): { owedToMe: Transfer[]; iOwe: Transfer[]; net: number } {
  const owedToMe = transfers.filter((t) => t.to === me);
  const iOwe = transfers.filter((t) => t.from === me);
  const sum = (list: Transfer[]) => list.reduce((n, t) => n + t.amount_minor, 0);
  return { owedToMe, iOwe, net: sum(owedToMe) - sum(iOwe) };
}

export type FeedItem = { kind: 'expense'; at: string; expense: Expense } | { kind: 'settlement'; at: string; settlement: Settlement };

/** Expenses and settlements in one list, newest first. */
export function splitFeed(expenses: Expense[], settlements: Settlement[]): FeedItem[] {
  const items: FeedItem[] = [
    ...expenses.map((expense) => ({ kind: 'expense' as const, at: expense.created_at, expense })),
    ...settlements.map((settlement) => ({ kind: 'settlement' as const, at: settlement.created_at, settlement })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * The line in the Leave / Remove confirmation when the person still has a balance; null when square.
 * Without a name it is about me: "You still owe ₹600. It stays on the trip's Split."
 */
export function balanceNote(net: number, currency = 'INR', name?: string): string | null {
  if (!net) return null;
  const amount = formatMoney(Math.abs(net), currency);
  const who = name ?? 'You';
  const verb = net < 0 ? `still ${name ? 'owes' : 'owe'}` : `${name ? 'is' : 'are'} still owed`;
  return `${who} ${verb} ${amount}. It stays on the trip's Split.`;
}

type ExpenseRow = Omit<Expense, 'shares'> & { expense_shares: Share[] | null };

const EXPENSE_COLUMNS = 'id, trip_id, title, category, amount_minor, paid_by, created_by, created_at, expense_shares(user_id, share_minor)';
const SETTLEMENT_COLUMNS = 'id, trip_id, from_user, to_user, amount_minor, created_by, created_at';

/** A trip's expenses and settlements, with balances, the simplified payments and (with `me`) my lines. */
export function useSplit(tripId?: string, me?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    const [expRes, setRes] = await Promise.all([
      supabase.from('expenses').select(EXPENSE_COLUMNS).eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('settlements').select(SETTLEMENT_COLUMNS).eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);
    const failed = expRes.error ?? setRes.error;
    setError(failed ? "Couldn't load the costs. Check your connection and try again." : null);
    if (!failed) {
      setExpenses(
        ((expRes.data ?? []) as unknown as ExpenseRow[]).map(({ expense_shares, ...e }) => ({
          ...e,
          amount_minor: Number(e.amount_minor),
          shares: (expense_shares ?? []).map((s) => ({ user_id: s.user_id, share_minor: Number(s.share_minor) })),
        })),
      );
      setSettlements(((setRes.data ?? []) as Settlement[]).map((x) => ({ ...x, amount_minor: Number(x.amount_minor) })));
    }
    setLoading(false);
  }, [tripId]);

  const derived = useMemo(() => {
    const balances = computeBalances(expenses, settlements);
    const transfers = simplifyDebts(balances);
    return {
      balances,
      transfers,
      lines: me ? myLines(transfers, me) : null,
      spent: expenses.reduce((n, e) => n + e.amount_minor, 0),
    };
  }, [expenses, settlements, me]);

  return { expenses, settlements, ...derived, loading, error, refresh };
}

export type ExpenseInput = {
  /** Set when editing an existing expense. */
  id?: string;
  title: string;
  category: Category;
  amountMinor: number;
  paidBy: string;
  splitWith: string[];
};

/** Adds or replaces an expense; the database works out the shares. Returns the expense id. */
export async function saveExpense(tripId: string, input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_expense', {
    t: tripId,
    expense: input.id ?? null,
    title: input.title.trim(),
    category: input.category,
    amount_minor: input.amountMinor,
    paid_by: input.paidBy,
    split_with: input.splitWith,
  });
  if (error) throw error;
  return data as string;
}

/** Deletes an expense and its shares (the author or an organiser; RLS enforces it). */
export async function deleteExpense(id: string): Promise<void> {
  const { data, error } = await supabase.from('expenses').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not deleted');
}

/** Records that `from` paid `to` back. I must be one of the two; RLS enforces it. */
export async function recordSettlement(tripId: string, from: string, to: string, amountMinor: number): Promise<void> {
  const { error } = await supabase.from('settlements').insert({ trip_id: tripId, from_user: from, to_user: to, amount_minor: amountMinor });
  if (error) throw error;
}

/** Removes a settlement I recorded. */
export async function undoSettlement(id: string): Promise<void> {
  const { data, error } = await supabase.from('settlements').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not deleted');
}
