import { act, renderHook } from '@testing-library/react-native';

import {
  addPlanItem,
  dayStyleFor,
  deletePlanItem,
  emptyDaysLine,
  formatTime,
  groupByDay,
  itemsOffDates,
  nameDays,
  parseTime,
  planErrorMessage,
  planProgress,
  tripDays,
  updatePlanItem,
  usePlan,
  type PlanItem,
} from '@/lib/itinerary';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

// 12 March 2027 is a Friday.
const FRI = '2027-03-12';
const SAT = '2027-03-13';
const SUN = '2027-03-14';
const MON = '2027-03-15';
const DAYS = [FRI, SAT, SUN, MON];

function item(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'i1',
    trip_id: 't1',
    day: FRI,
    start_time: '09:00:00',
    title: 'Beach',
    note: null,
    created_by: 'me',
    created_at: '2027-01-01T00:00:00Z',
    updated_at: '2027-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('tripDays', () => {
  it('lists every day, inclusive', () => {
    expect(tripDays(FRI, MON)).toEqual(DAYS);
    expect(tripDays(FRI, FRI)).toEqual([FRI]);
  });

  it('crosses months and leap days', () => {
    expect(tripDays('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('is empty when the end is before the start', () => {
    expect(tripDays(MON, FRI)).toEqual([]);
  });
});

describe('parseTime', () => {
  it.each([
    ['9', '09:00'],
    ['09', '09:00'],
    ['0', '00:00'],
    ['930', '09:30'],
    ['0930', '09:30'],
    ['1815', '18:15'],
    ['9:30', '09:30'],
    ['18.15', '18:15'],
    ['18h15', '18:15'],
    ['18:15:00', '18:15'],
    [' 7:05 ', '07:05'],
    ['23:59', '23:59'],
    ['6pm', '18:00'],
    ['6 PM', '18:00'],
    ['6:30pm', '18:30'],
    ['12am', '00:00'],
    ['12:15 am', '00:15'],
    ['12pm', '12:00'],
    ['9a', '09:00'],
  ])('reads %p as %p', (input, out) => {
    expect(parseTime(input)).toBe(out);
  });

  it.each(['', 'noon', '24', '24:00', '9:60', '960', '12345', '13pm', '0am', '9:3', ':30', '-1', '9::30'])('rejects %p', (input) => {
    expect(parseTime(input)).toBeNull();
  });
});

describe('formatTime', () => {
  it('drops the leading zero and the seconds', () => {
    expect(formatTime('09:00:00')).toBe('9:00');
    expect(formatTime('18:15:00')).toBe('18:15');
    expect(formatTime('00:30:00')).toBe('0:30');
    expect(formatTime('07:05')).toBe('7:05');
  });
});

describe('groupByDay', () => {
  it('groups by day in order, each day by time then by when it was added', () => {
    const items = [
      item({ id: 'c', day: SAT, start_time: '10:00:00' }),
      item({ id: 'b', day: FRI, start_time: '13:00:00' }),
      item({ id: 'a2', day: FRI, start_time: '09:00:00', created_at: '2027-01-02T00:00:00Z' }),
      item({ id: 'a1', day: FRI, start_time: '09:00:00', created_at: '2027-01-01T00:00:00Z' }),
    ];
    const grouped = groupByDay(items);
    expect([...grouped.keys()]).toEqual([FRI, SAT]);
    expect(grouped.get(FRI)!.map((i) => i.id)).toEqual(['a1', 'a2', 'b']);
    expect(grouped.get(SAT)!.map((i) => i.id)).toEqual(['c']);
  });

  it('is empty for no items', () => {
    expect(groupByDay([]).size).toBe(0);
  });
});

describe('planProgress', () => {
  it('counts planned days and lists the empty ones', () => {
    expect(planProgress(DAYS, [SAT, FRI, FRI])).toEqual({ planned: 2, total: 4, empty: [SUN, MON] });
  });

  it('ignores planned days outside the trip', () => {
    expect(planProgress(DAYS, ['2027-03-20'])).toEqual({ planned: 0, total: 4, empty: DAYS });
  });
});

describe('itemsOffDates', () => {
  it("finds items that aren't on the trip's days", () => {
    const off = item({ id: 'off', day: '2027-04-01' });
    expect(itemsOffDates([item(), off], DAYS)).toEqual([off]);
  });
});

describe('dayStyleFor', () => {
  it('uses weekdays up to a week, numbers after', () => {
    expect(dayStyleFor(tripDays('2027-03-01', '2027-03-07'))).toBe('weekday');
    expect(dayStyleFor(tripDays('2027-03-01', '2027-03-08'))).toBe('dayN');
  });
});

describe('nameDays', () => {
  it('names days by number', () => {
    expect(nameDays([SUN], DAYS, 'dayN')).toEqual({ text: 'Day 3', plural: false });
    expect(nameDays([SUN, MON], DAYS, 'dayN')).toEqual({ text: 'Day 3 and 4', plural: true });
  });
});

describe('emptyDaysLine', () => {
  it('says when every day has something', () => {
    expect(emptyDaysLine([], DAYS, 'weekday')).toBe('Every day has something planned.');
    expect(emptyDaysLine([], DAYS, 'dayN')).toBe('Every day has something planned.');
  });

  it('names one, two or more empty weekdays', () => {
    expect(emptyDaysLine([SAT], DAYS, 'weekday')).toBe('Saturday is wide open.');
    expect(emptyDaysLine([SAT, SUN], DAYS, 'weekday')).toBe('Saturday and Sunday are wide open.');
    expect(emptyDaysLine([FRI, SAT, SUN], DAYS, 'weekday')).toBe('Friday, Saturday and 1 more are wide open.');
    expect(emptyDaysLine(DAYS, DAYS, 'weekday')).toBe('Friday, Saturday and 2 more are wide open.');
  });

  it('names days by number', () => {
    expect(emptyDaysLine([MON], DAYS, 'dayN')).toBe('Day 4 is wide open.');
    expect(emptyDaysLine([SUN, MON], DAYS, 'dayN')).toBe('Day 3 and 4 are wide open.');
    expect(emptyDaysLine(DAYS, DAYS, 'dayN')).toBe('Day 1, 2 and 2 more are wide open.');
  });
});

describe('planErrorMessage', () => {
  it('explains a refusal off the dates', () => {
    expect(planErrorMessage({ code: '42501', message: 'new row violates row-level security policy for table "itinerary_items"' })).toBe(
      "Plans can only go on the trip's dates.",
    );
    expect(planErrorMessage({ message: 'new row violates row-level security policy' })).toBe("Plans can only go on the trip's dates.");
  });

  it('explains a time it could not read', () => {
    expect(planErrorMessage(new Error('BAD_TIME'))).toBe('Enter a time like 9:30 or 18:00.');
  });

  it('falls back to a connection message', () => {
    expect(planErrorMessage({ message: 'Failed to fetch' })).toBe("Couldn't save the plan. Check your connection and try again.");
    expect(planErrorMessage(null)).toBe("Couldn't save the plan. Check your connection and try again.");
  });
});

describe('usePlan', () => {
  it("loads the trip's items in order", async () => {
    queueResult('itinerary_items', { data: [item()] });
    const { result } = await renderHook(() => usePlan('t1'));
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ loading: false, error: null, items: [item()] });
    expect(queriesFor('itinerary_items')[0].ops).toEqual([
      ['select', ['id, trip_id, day, start_time, title, note, created_by, created_at, updated_at']],
      ['eq', ['trip_id', 't1']],
      ['order', ['day']],
      ['order', ['start_time']],
      ['order', ['created_at']],
    ]);
  });

  it('keeps the last items and shows an error when loading fails', async () => {
    queueResult('itinerary_items', { data: [item()] }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => usePlan('t1'));
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBe("Couldn't load the plan. Check your connection and try again.");
  });

  it('does nothing without a trip', async () => {
    const { result } = await renderHook(() => usePlan(undefined));
    await act(() => result.current.refresh());
    expect(queriesFor('itinerary_items')).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });
});

describe('addPlanItem', () => {
  it('inserts the item with a parsed time and trimmed text, and returns its id', async () => {
    queueResult('itinerary_items', { data: { id: 'new' } });
    await expect(addPlanItem('t1', { day: SAT, time: '930', title: '  Snorkelling ', note: '  Bring fins ' })).resolves.toBe('new');
    expect(queriesFor('itinerary_items')[0].ops).toEqual([
      ['insert', [{ trip_id: 't1', day: SAT, start_time: '09:30', title: 'Snorkelling', note: 'Bring fins' }]],
      ['select', ['id']],
      ['single', []],
    ]);
  });

  it('stores an empty note as null', async () => {
    queueResult('itinerary_items', { data: { id: 'new' } });
    await addPlanItem('t1', { day: SAT, time: '9', title: 'A', note: '   ' });
    expect((queriesFor('itinerary_items')[0].ops[0][1][0] as { note: unknown }).note).toBeNull();
  });

  it("refuses a time it can't read without calling the database", async () => {
    await expect(addPlanItem('t1', { day: SAT, time: 'noon', title: 'A' })).rejects.toThrow('BAD_TIME');
    expect(queriesFor('itinerary_items')).toHaveLength(0);
  });

  it('throws the database error', async () => {
    queueResult('itinerary_items', { error: { code: '42501', message: 'new row violates row-level security policy' } });
    await expect(addPlanItem('t1', { day: '2027-05-01', time: '9', title: 'A' })).rejects.toMatchObject({ code: '42501' });
  });
});

describe('updatePlanItem', () => {
  it('updates the content of the item', async () => {
    queueResult('itinerary_items', { data: [{ id: 'i1' }] });
    await updatePlanItem('i1', { day: SUN, time: '18.15', title: 'Dinner' });
    expect(queriesFor('itinerary_items')[0].ops).toEqual([
      ['update', [{ day: SUN, start_time: '18:15', title: 'Dinner', note: null }]],
      ['eq', ['id', 'i1']],
      ['select', ['id']],
    ]);
  });

  it("throws 'Not changed' when RLS let nothing through", async () => {
    queueResult('itinerary_items', { data: [] });
    await expect(updatePlanItem('i1', { day: SUN, time: '9', title: 'A' })).rejects.toThrow('Not changed');
  });

  it('throws the database error', async () => {
    queueResult('itinerary_items', { error: { message: 'offline' } });
    await expect(updatePlanItem('i1', { day: SUN, time: '9', title: 'A' })).rejects.toEqual({ message: 'offline' });
  });
});

describe('deletePlanItem', () => {
  it('deletes the item', async () => {
    queueResult('itinerary_items', { data: [{ id: 'i1' }] });
    await deletePlanItem('i1');
    expect(queriesFor('itinerary_items')[0].ops).toEqual([
      ['delete', []],
      ['eq', ['id', 'i1']],
      ['select', ['id']],
    ]);
  });

  it('throws when nothing was deleted', async () => {
    queueResult('itinerary_items', { data: [] });
    await expect(deletePlanItem('i1')).rejects.toThrow('Not deleted');
  });

  it('throws the database error', async () => {
    queueResult('itinerary_items', { error: { message: 'offline' } });
    await expect(deletePlanItem('i1')).rejects.toEqual({ message: 'offline' });
  });
});
