import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DayCalendar, type CalendarMode } from '@/components/day-calendar';
import { formatDay } from '@/lib/dates';
import { palette } from '@/theme/tokens';


const long = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
const bg = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { backgroundColor?: string }).backgroundColor;

type Opts = Partial<{ mode: CalendarMode; myDays: Set<string>; counts: Map<string, number>; readOnly: boolean; selected: string | null; memberCount: number }>;

async function renderCalendar(opts: Opts = {}) {
  const onToggle = jest.fn();
  const onSelect = jest.fn();
  await render(
    <DayCalendar
      from="2027-03-10"
      to="2027-04-05"
      today="2027-03-12"
      mode={opts.mode ?? 'mine'}
      myDays={opts.myDays ?? new Set()}
      counts={opts.counts ?? new Map()}
      memberCount={opts.memberCount ?? 3}
      selected={opts.selected ?? null}
      readOnly={opts.readOnly ?? false}
      onToggle={onToggle}
      onSelect={onSelect}
    />,
  );
  return { onToggle, onSelect };
}

describe('DayCalendar', () => {
  it('renders a heading per month in the range', async () => {
    await renderCalendar();
    expect(screen.getAllByRole('header')).toHaveLength(2);
  });

  it('marks a free day in Mine mode', async () => {
    const { onToggle } = await renderCalendar();
    await fireEvent.press(screen.getByLabelText(long('2027-03-15')));
    expect(onToggle).toHaveBeenCalledWith('2027-03-15', true);
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it('clears a day I already marked', async () => {
    const { onToggle } = await renderCalendar({ myDays: new Set(['2027-03-15']) });
    const cell = screen.getByLabelText(`${long('2027-03-15')}, you are free`);
    expect(cell.props.accessibilityState).toMatchObject({ selected: true });
    expect(bg(cell)).toBe(palette.light.accent);
    await fireEvent.press(cell);
    expect(onToggle).toHaveBeenCalledWith('2027-03-15', false);
  });

  it("can't mark past days or days outside the range", async () => {
    const { onToggle } = await renderCalendar();
    const past = screen.getByLabelText(`${long('2027-03-11')}, not available`);
    expect(past.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(past);
    // 1 March is shown in the grid but is before `from`.
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-01')}, not available`));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("can't mark days when read-only", async () => {
    const { onToggle } = await renderCalendar({ readOnly: true });
    const cell = screen.getByLabelText(long('2027-03-15'));
    expect(cell.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(cell);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('mentions how many are free in Mine mode when anyone is', async () => {
    await renderCalendar({ counts: new Map([['2027-03-15', 2]]) });
    expect(screen.getByLabelText(`${long('2027-03-15')}, 2 of 3 free`)).toBeTruthy();
  });

  it('shades days by how many are free in Everyone mode', async () => {
    await renderCalendar({
      mode: 'all',
      counts: new Map([
        ['2027-03-14', 1],
        ['2027-03-15', 2],
        ['2027-03-16', 3],
      ]),
    });
    const heat = palette.light.heat;
    expect(bg(screen.getByLabelText(`${long('2027-03-13')}, 0 of 3 free`))).toBe(heat[0]);
    expect(bg(screen.getByLabelText(`${long('2027-03-14')}, 1 of 3 free`))).toBe(heat[1]);
    expect(bg(screen.getByLabelText(`${long('2027-03-15')}, 2 of 3 free`))).toBe(heat[2]);
    expect(bg(screen.getByLabelText(`${long('2027-03-16')}, 3 of 3 free`))).toBe(heat[3]);
  });

  it('selects a day in Everyone mode, even when read-only', async () => {
    const { onSelect, onToggle } = await renderCalendar({ mode: 'all', readOnly: true, selected: '2027-03-20' });
    expect(screen.getByLabelText(`${long('2027-03-20')}, 0 of 3 free`).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, 0 of 3 free`));
    expect(onSelect).toHaveBeenCalledWith('2027-03-15');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("doesn't divide by zero with no members", async () => {
    await renderCalendar({ mode: 'all', memberCount: 0, counts: new Map([['2027-03-15', 1]]) });
    expect(bg(screen.getByLabelText(`${long('2027-03-15')}, 1 of 0 free`))).toBe(palette.light.heat[3]);
  });
});
