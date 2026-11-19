import type { Day, MonthGrid } from './dates';

export type Point = { x: number; y: number };

export type GridMetrics = {
  /** Width of the month page. */
  width: number;
  /** Cell height. */
  cell: number;
  /** Gap between rows and between columns. */
  gap: number;
};

const COLUMNS = 7;

/** The day under a point on a month page, or null on a gap, a padding cell or outside the page. */
export function dayAtPoint(month: MonthGrid, { x, y }: Point, { width, cell, gap }: GridMetrics): Day | null {
  if (x < 0 || y < 0 || x >= width) return null;
  const colWidth = (width - gap * (COLUMNS - 1)) / COLUMNS;
  const col = Math.floor(x / (colWidth + gap));
  const row = Math.floor(y / (cell + gap));
  // A point in the gap between two cells belongs to neither.
  if (x - col * (colWidth + gap) > colWidth || y - row * (cell + gap) > cell) return null;
  return month.weeks[row]?.[col] ?? null;
}

/**
 * Points from `a` to `b` (both excluded `a`, including `b`), at most `step` apart. A fast drag reports points
 * several cells apart; sampling between them keeps the stroke from skipping days.
 */
export function pointsBetween(a: Point, b: Point, step: number): Point[] {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(dist / step));
  const out: Point[] = [];
  for (let i = 1; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  return out;
}

/**
 * One drag across the calendar. The first day decides whether the stroke marks or clears; every later day it
 * touches gets the same state, once. `canEdit` skips days that can't change (past, outside the window).
 */
export class Stroke {
  private seen = new Set<Day>();
  readonly free: boolean;

  constructor(
    start: Day,
    private readonly isFree: (day: Day) => boolean,
    private readonly canEdit: (day: Day) => boolean,
  ) {
    this.free = !isFree(start);
    this.seen.add(start);
  }

  /** The days to change for this one: [] when it was already handled or can't change. */
  next(day: Day): Day[] {
    if (this.seen.has(day)) return [];
    this.seen.add(day);
    if (!this.canEdit(day) || this.isFree(day) === this.free) return [];
    return [day];
  }
}
