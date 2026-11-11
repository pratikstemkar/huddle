import {
  WINDOW_MONTHS,
  addDays,
  formatDay,
  formatRange,
  formatTripDates,
  fromDay,
  monthGrids,
  nightsBetween,
  toDay,
  today,
  windowEnd,
} from '@/lib/dates';

const short = { day: 'numeric', month: 'short' } as const;

describe('toDay / fromDay', () => {
  it('formats a UTC date as YYYY-MM-DD with zero padding', () => {
    expect(toDay(new Date(Date.UTC(2027, 0, 5)))).toBe('2027-01-05');
    expect(toDay(new Date(Date.UTC(2027, 11, 31, 23, 59)))).toBe('2027-12-31');
  });

  it('parses a day to midnight UTC', () => {
    expect(fromDay('2027-03-09').toISOString()).toBe('2027-03-09T00:00:00.000Z');
  });

  it('round-trips', () => {
    for (const d of ['2024-02-29', '2027-01-01', '2027-12-31']) expect(toDay(fromDay(d))).toBe(d);
  });
});

describe('today', () => {
  afterEach(() => jest.useRealTimers());

  it("uses the device's local calendar date", () => {
    jest.useFakeTimers();
    const now = new Date(2027, 5, 7, 12, 0); // local noon on 7 June
    jest.setSystemTime(now);
    expect(today()).toBe('2027-06-07');
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2027-03-10', 1)).toBe('2027-03-11');
    expect(addDays('2027-03-10', -10)).toBe('2027-02-28');
    expect(addDays('2027-03-10', 0)).toBe('2027-03-10');
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01');
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('is not shifted by daylight saving (all maths is UTC)', () => {
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29');
    expect(addDays('2027-10-30', 2)).toBe('2027-11-01');
  });
});

describe('windowEnd', () => {
  it(`is ${WINDOW_MONTHS} months after the start`, () => {
    expect(WINDOW_MONTHS).toBe(4);
    expect(windowEnd('2027-01-15')).toBe('2027-05-15');
    expect(windowEnd('2027-10-01')).toBe('2028-02-01');
  });
});

describe('monthGrids', () => {
  it('returns one grid per month from the start month to the end month', () => {
    const grids = monthGrids('2027-01-20', '2027-03-02');
    expect(grids.map((g) => g.key)).toEqual(['2027-01', '2027-02', '2027-03']);
  });

  it('returns a single grid when both days are in the same month', () => {
    expect(monthGrids('2027-06-01', '2027-06-30').map((g) => g.key)).toEqual(['2027-06']);
  });

  it('includes the whole year boundary', () => {
    expect(monthGrids('2027-12-10', '2028-01-05').map((g) => g.key)).toEqual(['2027-12', '2028-01']);
  });

  it('lays weeks out Monday first, padding with null', () => {
    // 1 Feb 2027 is a Monday and February 2027 has exactly 28 days: four full weeks, no padding.
    const [feb] = monthGrids('2027-02-01', '2027-02-28');
    expect(feb.weeks).toHaveLength(4);
    expect(feb.weeks[0][0]).toBe('2027-02-01');
    expect(feb.weeks[3][6]).toBe('2027-02-28');
    expect(feb.weeks.flat()).not.toContain(null);

    // 1 Jan 2027 is a Friday: four blanks first (Mon-Thu).
    const [jan] = monthGrids('2027-01-01', '2027-01-31');
    expect(jan.weeks[0]).toEqual([null, null, null, null, '2027-01-01', '2027-01-02', '2027-01-03']);
  });

  it('every week has 7 cells and every day of the month appears once', () => {
    const [mar] = monthGrids('2027-03-01', '2027-03-31');
    for (const w of mar.weeks) expect(w).toHaveLength(7);
    const days = mar.weeks.flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2027-03-01');
    expect(days[30]).toBe('2027-03-31');
  });

  it('handles a Sunday first-of-month (six blanks first)', () => {
    // 1 Aug 2027 is a Sunday.
    const [aug] = monthGrids('2027-08-01', '2027-08-31');
    expect(aug.weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(aug.weeks[0][6]).toBe('2027-08-01');
  });

  it('labels each month with its name and year', () => {
    const [g] = monthGrids('2027-05-10', '2027-05-11');
    expect(g.label).toContain('2027');
    expect(g.label).toBe(new Date(Date.UTC(2027, 4, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  });

  it('returns nothing when the end is before the start month', () => {
    expect(monthGrids('2027-05-10', '2027-04-01')).toEqual([]);
  });
});

describe('formatDay', () => {
  it('formats in UTC so the day never shifts', () => {
    expect(formatDay('2027-03-01')).toBe(new Date(Date.UTC(2027, 2, 1)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
    expect(formatDay('2027-03-01', { day: 'numeric' })).toBe('1');
  });
});

describe('formatRange', () => {
  it('shows one date for a single day', () => {
    expect(formatRange('2027-03-12', '2027-03-12')).toBe(formatDay('2027-03-12', short));
  });

  it('shows only the end day number within one month', () => {
    expect(formatRange('2027-03-12', '2027-03-14')).toBe(`${formatDay('2027-03-12', short)}–14`);
  });

  it('shows both dates across months', () => {
    expect(formatRange('2027-03-30', '2027-04-02')).toBe(`${formatDay('2027-03-30', short)}–${formatDay('2027-04-02', short)}`);
  });

  it('shows both dates for the same month in different years', () => {
    expect(formatRange('2027-03-30', '2028-03-02')).toBe(`${formatDay('2027-03-30', short)}–${formatDay('2028-03-02', short)}`);
  });
});

describe('nightsBetween', () => {
  it('counts nights', () => {
    expect(nightsBetween('2027-03-12', '2027-03-12')).toBe(0);
    expect(nightsBetween('2027-03-12', '2027-03-14')).toBe(2);
    expect(nightsBetween('2027-02-27', '2027-03-02')).toBe(3);
    expect(nightsBetween('2027-12-31', '2028-01-01')).toBe(1);
  });
});

describe('formatTripDates', () => {
  it('shows one full date for a one-day trip', () => {
    expect(formatTripDates('2027-03-12', '2027-03-12')).toBe(formatDay('2027-03-12'));
  });

  it('shows full start and end dates', () => {
    expect(formatTripDates('2027-03-12', '2027-03-14')).toBe(`${formatDay('2027-03-12')} – ${formatDay('2027-03-14')}`);
  });
});
