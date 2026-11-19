import { dayAtPoint, pointsBetween, Stroke } from '@/lib/calendar-grid';
import { monthGrids } from '@/lib/dates';

// March 2027 starts on a Monday; 7 columns of 44 with 4 gaps.
const [march] = monthGrids('2027-03-01', '2027-03-31');
const metrics = { width: 7 * 44 + 6 * 4, cell: 44, gap: 4 };

describe('dayAtPoint', () => {
  it('finds the day under a point', () => {
    expect(dayAtPoint(march, { x: 10, y: 10 }, metrics)).toBe('2027-03-01');
    expect(dayAtPoint(march, { x: 48 + 10, y: 10 }, metrics)).toBe('2027-03-02');
    expect(dayAtPoint(march, { x: 10, y: 48 + 10 }, metrics)).toBe('2027-03-08');
    expect(dayAtPoint(march, { x: 6 * 48 + 10, y: 10 }, metrics)).toBe('2027-03-07');
  });

  it('returns null in a gap, outside the page and on padding cells', () => {
    expect(dayAtPoint(march, { x: 46, y: 10 }, metrics)).toBeNull();
    expect(dayAtPoint(march, { x: 10, y: 46 }, metrics)).toBeNull();
    expect(dayAtPoint(march, { x: -1, y: 10 }, metrics)).toBeNull();
    expect(dayAtPoint(march, { x: metrics.width + 5, y: 10 }, metrics)).toBeNull();
    // Row 5 (the sixth) is padding in March 2027.
    expect(dayAtPoint(march, { x: 10, y: 5 * 48 + 10 }, metrics)).toBeNull();
  });
});

describe('pointsBetween', () => {
  it('samples a long move so no cell is skipped', () => {
    const pts = pointsBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, 22);
    expect(pts).toHaveLength(5);
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('returns just the end for no movement', () => {
    expect(pointsBetween({ x: 5, y: 5 }, { x: 5, y: 5 }, 22)).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('Stroke', () => {
  const free = new Set(['2027-03-03']);
  const canEdit = (d: string) => d >= '2027-03-02';

  it('marks days when the first one was not free, once each', () => {
    const s = new Stroke('2027-03-02', (d) => free.has(d), canEdit);
    expect(s.free).toBe(true);
    expect(s.next('2027-03-03')).toEqual([]); // already free
    expect(s.next('2027-03-04')).toEqual(['2027-03-04']);
    expect(s.next('2027-03-04')).toEqual([]); // already handled
    expect(s.next('2027-03-01')).toEqual([]); // can't edit
  });

  it('clears days when the first one was free', () => {
    const s = new Stroke('2027-03-03', (d) => free.has(d), canEdit);
    expect(s.free).toBe(false);
    expect(s.next('2027-03-04')).toEqual([]); // already clear
  });
});
