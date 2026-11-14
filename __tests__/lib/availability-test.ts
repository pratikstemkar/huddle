import { act, renderHook, waitFor } from '@testing-library/react-native';

import { bestRanges, summarise, useAvailability } from '@/lib/availability';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

const ME = 'me';
const rows = [
  { user_id: ME, day: '2027-03-10' },
  { user_id: 'b', day: '2027-03-10' },
  { user_id: 'c', day: '2027-03-10' },
  { user_id: ME, day: '2027-03-11' },
  { user_id: 'b', day: '2027-03-12' },
];

describe('summarise', () => {
  it('collects my days, who is free and the counts', () => {
    const s = summarise(rows, ME);
    expect([...s.myDays]).toEqual(['2027-03-10', '2027-03-11']);
    expect(s.who.get('2027-03-10')).toEqual([ME, 'b', 'c']);
    expect(s.who.get('2027-03-12')).toEqual(['b']);
    expect(Object.fromEntries(s.counts)).toEqual({ '2027-03-10': 3, '2027-03-11': 1, '2027-03-12': 1 });
  });

  it('has no days of mine when signed out', () => {
    expect(summarise(rows, undefined).myDays.size).toBe(0);
  });

  it('takes counts from day_counts when given, so hidden people still count', () => {
    const s = summarise([{ user_id: ME, day: '2027-03-10' }], ME, [{ day: '2027-03-10', free: 3 }, { day: '2027-03-12', free: 1 }]);
    expect(s.who.get('2027-03-10')).toEqual([ME]);
    expect(Object.fromEntries(s.counts)).toEqual({ '2027-03-10': 3, '2027-03-12': 1 });
  });

  it('is empty for no rows', () => {
    const s = summarise([], ME);
    expect(s.myDays.size + s.who.size + s.counts.size).toBe(0);
  });
});

describe('bestRanges', () => {
  const counts = (o: Record<string, number>) => new Map(Object.entries(o));

  it('returns nothing when fewer than 2 people overlap', () => {
    expect(bestRanges(counts({ '2027-03-10': 1, '2027-03-11': 1 }), '2027-03-01')).toEqual([]);
    expect(bestRanges(new Map(), '2027-03-01')).toEqual([]);
  });

  it('merges back-to-back days at the top level into ranges', () => {
    const c = counts({ '2027-03-10': 3, '2027-03-11': 3, '2027-03-12': 2, '2027-03-14': 3 });
    expect(bestRanges(c, '2027-03-01')).toEqual([
      { start: '2027-03-10', end: '2027-03-11', free: 3 },
      { start: '2027-03-14', end: '2027-03-14', free: 3 },
    ]);
  });

  it('ignores days before `from`', () => {
    const c = counts({ '2027-03-01': 5, '2027-03-10': 2 });
    expect(bestRanges(c, '2027-03-05')).toEqual([{ start: '2027-03-10', end: '2027-03-10', free: 2 }]);
  });

  it('includes `from` itself', () => {
    expect(bestRanges(counts({ '2027-03-05': 2 }), '2027-03-05')).toHaveLength(1);
  });

  it('sorts unordered input and merges across month ends', () => {
    const c = counts({ '2027-04-01': 2, '2027-03-31': 2 });
    expect(bestRanges(c, '2027-03-01')).toEqual([{ start: '2027-03-31', end: '2027-04-01', free: 2 }]);
  });

  it('returns at most `limit` ranges, earliest first', () => {
    const c = counts({ '2027-03-01': 2, '2027-03-03': 2, '2027-03-05': 2, '2027-03-07': 2 });
    expect(bestRanges(c, '2027-03-01').map((r) => r.start)).toEqual(['2027-03-01', '2027-03-03', '2027-03-05']);
    expect(bestRanges(c, '2027-03-01', 1)).toHaveLength(1);
  });
});

describe('useAvailability', () => {
  it('loads and summarises the trip days', async () => {
    queueResult('availability', { data: rows });
    queueResult('day_counts', { data: [{ day: '2027-03-10', free: 3 }, { day: '2027-03-11', free: 1 }, { day: '2027-03-12', free: 1 }] });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.counts.get('2027-03-10')).toBe(3);
    expect(result.current.myDays.has('2027-03-11')).toBe(true);
    expect(queriesFor('availability')[0].ops).toEqual([
      ['select', ['user_id, day']],
      ['eq', ['trip_id', 't1']],
    ]);
    expect(queriesFor('day_counts')[0].ops).toEqual([
      ['select', ['day, free']],
      ['eq', ['trip_id', 't1']],
    ]);
  });

  it('shows an error when the counts fail to load', async () => {
    queueResult('availability', { data: rows });
    queueResult('day_counts', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());
    expect(result.current.error).toMatch(/Couldn't load/);
  });

  it('counts hidden people when marking a day', async () => {
    // Names hidden: no rows for others, but day_counts says 2 people are free.
    queueResult('availability', { data: [] });
    queueResult('day_counts', { data: [{ day: '2027-03-12', free: 2 }] });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());
    await act(() => result.current.setDay('2027-03-12', true));
    expect(result.current.counts.get('2027-03-12')).toBe(3);
    expect(result.current.who.get('2027-03-12')).toEqual([ME]);
    await act(() => result.current.setDay('2027-03-12', false));
    expect(result.current.counts.get('2027-03-12')).toBe(2);
  });

  it('shows an error when loading fails', async () => {
    queueResult('availability', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());
    expect(result.current.error).toMatch(/Couldn't load/);
    expect(result.current.loading).toBe(false);
  });

  it('does nothing without a trip id', async () => {
    const { result } = await renderHook(() => useAvailability(undefined, ME));
    await act(() => result.current.refresh());
    expect(queriesFor('availability')).toHaveLength(0);
  });

  it('marks a day straight away and saves it', async () => {
    queueResult('availability', { data: [{ user_id: 'b', day: '2027-03-12' }] });
    queueResult('day_counts', { data: [{ day: '2027-03-12', free: 1 }] });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());

    await act(() => result.current.setDay('2027-03-12', true));
    expect(result.current.myDays.has('2027-03-12')).toBe(true);
    expect(result.current.counts.get('2027-03-12')).toBe(2);
    expect(result.current.who.get('2027-03-12')).toEqual(['b', ME]);
    const save = queriesFor('availability')[1];
    expect(save.ops[0]).toEqual(['upsert', [{ trip_id: 't1', user_id: ME, day: '2027-03-12' }, { onConflict: 'trip_id,user_id,day', ignoreDuplicates: true }]]);
  });

  it('clears a day and removes it entirely when nobody is left', async () => {
    queueResult('availability', { data: [{ user_id: ME, day: '2027-03-12' }] });
    queueResult('day_counts', { data: [{ day: '2027-03-12', free: 1 }] });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());

    await act(() => result.current.setDay('2027-03-12', false));
    expect(result.current.myDays.size).toBe(0);
    expect(result.current.counts.has('2027-03-12')).toBe(false);
    expect(result.current.who.has('2027-03-12')).toBe(false);
    expect(queriesFor('availability')[1].ops).toEqual([
      ['delete', []],
      ['eq', ['trip_id', 't1']],
      ['eq', ['user_id', ME]],
      ['eq', ['day', '2027-03-12']],
    ]);
  });

  it('rolls back and shows an error when saving fails', async () => {
    queueResult('availability', { data: [] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useAvailability('t1', ME));
    await act(() => result.current.refresh());

    await act(() => result.current.setDay('2027-03-12', true));
    expect(result.current.myDays.has('2027-03-12')).toBe(false);
    expect(result.current.counts.has('2027-03-12')).toBe(false);
    expect(result.current.error).toMatch(/Couldn't save/);
  });

  it("doesn't save when signed out", async () => {
    const { result } = await renderHook(() => useAvailability('t1', undefined));
    await act(() => result.current.setDay('2027-03-12', true));
    await waitFor(() => expect(queriesFor('availability')).toHaveLength(0));
    expect(result.current.myDays.size).toBe(0);
  });
});
