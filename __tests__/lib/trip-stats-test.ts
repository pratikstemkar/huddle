import { act, renderHook } from '@testing-library/react-native';

import { photosCardText, planCardText, splitCardText, tripNudge, useTripStats, type TripStats } from '@/lib/trip-stats';
import { MEMBER, ORGANISER, trip } from '../../test-utils/fixtures';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

const locked = trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-16' });

function stats(overrides: Partial<TripStats> = {}): TripStats {
  return {
    trip_id: locked.id,
    planned_days: [],
    photo_count: 0,
    photo_people: 0,
    my_photos: 0,
    spent_minor: 0,
    my_net_minor: 0,
    ...overrides,
  };
}

describe('planCardText', () => {
  it('counts the planned days', () => {
    expect(planCardText(locked, stats({ planned_days: ['2027-03-12', '2027-03-13', '2027-03-15'] }))).toBe('3 of 5 days planned');
    expect(planCardText(locked, null)).toBe('0 of 5 days planned');
  });

  it('uses the singular for a one-day trip', () => {
    expect(planCardText(trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-12' }), stats({ planned_days: ['2027-03-12'] }))).toBe(
      '1 of 1 day planned',
    );
  });

  it('works on fixed dates before the trip is locked', () => {
    expect(planCardText(trip({ fixed_start: '2027-03-12', fixed_end: '2027-03-13' }), stats())).toBe('0 of 2 days planned');
  });

  it('waits for dates', () => {
    expect(planCardText(trip(), stats())).toBe('Opens once dates are locked');
  });
});

describe('splitCardText', () => {
  it('says what I am owed or owe', () => {
    expect(splitCardText(stats({ spent_minor: 1840000, my_net_minor: 125000 }))).toEqual({ text: "You're owed ₹1,250", tone: 'owed' });
    expect(splitCardText(stats({ spent_minor: 1840000, my_net_minor: -60000 }))).toEqual({ text: 'You owe ₹600', tone: 'owe' });
  });

  it('is square, or empty', () => {
    expect(splitCardText(stats({ spent_minor: 1000, my_net_minor: 0 }))).toEqual({ text: "You're all square", tone: 'muted' });
    expect(splitCardText(stats())).toEqual({ text: 'Nothing spent yet', tone: 'muted' });
    expect(splitCardText(null)).toEqual({ text: 'Nothing spent yet', tone: 'muted' });
  });

  it('uses the trip currency', () => {
    expect(splitCardText(stats({ spent_minor: 1000, my_net_minor: 1050 }), 'EUR').text).toMatch(/^You're owed €10\.50$/);
  });
});

describe('photosCardText', () => {
  it('counts photos', () => {
    expect(photosCardText(24)).toBe('24 so far');
    expect(photosCardText(1)).toBe('1 so far');
    expect(photosCardText(0)).toBe('None yet');
  });
});

describe('tripNudge', () => {
  const BEFORE = '2027-03-01';
  const AFTER = '2027-03-20';
  const owing = [
    { from: ORGANISER, to: MEMBER, amount_minor: 60000 },
    { from: ORGANISER, to: 'gone', amount_minor: 100 },
  ];

  it('asks to fill empty days first', () => {
    const s = stats({ planned_days: ['2027-03-12', '2027-03-13', '2027-03-14'] });
    expect(tripNudge(locked, s, ORGANISER, owing, BEFORE)).toEqual({ text: 'Day 4 and 5 are still empty. Want to add something?', action: 'plan' });
    expect(tripNudge(locked, stats({ planned_days: ['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15'] }), ORGANISER, [], BEFORE)).toEqual({
      text: 'Day 5 is still empty. Want to add something?',
      action: 'plan',
    });
  });

  it('then asks me to settle up with the person I owe most', () => {
    const full = stats({ planned_days: ['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16'] });
    expect(tripNudge(locked, full, ORGANISER, owing, BEFORE)).toEqual({ text: 'You owe Meera ₹600. Settle up?', action: 'split' });
    expect(tripNudge(locked, full, ORGANISER, [{ from: ORGANISER, to: 'gone', amount_minor: 100 }], BEFORE)!.text).toBe('You owe someone ₹1. Settle up?');
  });

  it("ignores payments that aren't mine", () => {
    const full = stats({ planned_days: ['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16'] });
    expect(tripNudge(locked, full, MEMBER, owing, BEFORE)).toBeNull();
  });

  it('after the trip, skips empty days and asks for my photos', () => {
    expect(tripNudge(locked, stats(), ORGANISER, [], AFTER)).toEqual({ text: 'Add your photos so everyone gets the full album.', action: 'photos' });
    expect(tripNudge(locked, stats({ my_photos: 3 }), ORGANISER, [], AFTER)).toBeNull();
    // Money still comes before photos.
    expect(tripNudge(locked, stats(), ORGANISER, owing, AFTER)!.action).toBe('split');
  });

  it('works for fixed dates too', () => {
    const fixed = trip({ fixed_start: '2027-03-12', fixed_end: '2027-03-12' });
    expect(tripNudge(fixed, stats(), ORGANISER, [], BEFORE)).toEqual({ text: 'Day 1 is still empty. Want to add something?', action: 'plan' });
  });

  it('is null for a trip without dates, so the Vote rules apply', () => {
    expect(tripNudge(trip(), stats(), ORGANISER, owing, BEFORE)).toBeNull();
  });

  it('only nudges about money before the stats load', () => {
    expect(tripNudge(locked, null, ORGANISER, [], BEFORE)).toBeNull();
    expect(tripNudge(locked, null, ORGANISER, owing, BEFORE)!.action).toBe('split');
  });
});

describe('useTripStats', () => {
  it("loads the trip's row and turns numbers into numbers", async () => {
    queueResult('trip_stats', {
      data: { trip_id: 't1', planned_days: null, photo_count: 3, photo_people: 2, my_photos: 1, spent_minor: '1840000', my_net_minor: '-60000' },
    });
    const { result } = await renderHook(() => useTripStats('t1'));
    await act(() => result.current.refresh());
    expect(result.current.stats).toEqual({ trip_id: 't1', planned_days: [], photo_count: 3, photo_people: 2, my_photos: 1, spent_minor: 1840000, my_net_minor: -60000 });
    expect(queriesFor('trip_stats')[0].ops).toEqual([
      ['select', ['trip_id, planned_days, photo_count, photo_people, my_photos, spent_minor, my_net_minor']],
      ['eq', ['trip_id', 't1']],
      ['maybeSingle', []],
    ]);
  });

  it('keeps the last numbers and reports an error when loading fails', async () => {
    queueResult('trip_stats', { data: { trip_id: 't1', planned_days: [], photo_count: 1 } }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useTripStats('t1'));
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.stats?.photo_count).toBe(1);
    expect(result.current.error).toBe("Couldn't load the trip's numbers.");
  });

  it('does nothing without a trip', async () => {
    const { result } = await renderHook(() => useTripStats(undefined));
    await act(() => result.current.refresh());
    expect(queriesFor('trip_stats')).toHaveLength(0);
  });
});
