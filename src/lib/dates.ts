/** Calendar-day helpers. A "day" is a `YYYY-MM-DD` string; all maths is in UTC so days never shift with the timezone. */

export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(d: Date): Day {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fromDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Today in the user's local calendar, as a day. */
export function today(): Day {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export function addDays(day: Day, n: number): Day {
  const d = fromDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** How far ahead people can mark days. */
export const WINDOW_MONTHS = 4;

export function windowEnd(from: Day): Day {
  const d = fromDay(from);
  d.setUTCMonth(d.getUTCMonth() + WINDOW_MONTHS);
  return toDay(d);
}

export type MonthGrid = {
  key: string;
  label: string;
  /** Weeks of 7 cells, Monday first; `null` pads days outside the month. */
  weeks: (Day | null)[][];
};

/** Months from the one containing `from` to the one containing `to`. */
export function monthGrids(from: Day, to: Day): MonthGrid[] {
  const start = fromDay(from);
  const end = fromDay(to);
  const out: MonthGrid[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (cur.getUTCDay() + 6) % 7; // Monday = 0
    const cells: (Day | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m + 1)}-${pad(d)}`);
    while (cells.length % 7) cells.push(null);
    const weeks: (Day | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    out.push({
      key: `${y}-${pad(m + 1)}`,
      label: cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      weeks,
    });
    cur.setUTCMonth(m + 1);
  }
  return out;
}

export function formatDay(day: Day, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return fromDay(day).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

export function formatRange(start: Day, end: Day) {
  if (start === end) return formatDay(start, { day: 'numeric', month: 'short' });
  const s = fromDay(start);
  const e = fromDay(end);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const first = formatDay(start, { day: 'numeric', month: 'short' });
  const last = sameMonth ? String(e.getUTCDate()) : formatDay(end, { day: 'numeric', month: 'short' });
  return `${first}–${last}`;
}
