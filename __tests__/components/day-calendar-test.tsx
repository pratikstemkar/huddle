import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DayCalendar, type CalendarMode, type CalendarPerson } from '@/components/day-calendar';
import { formatDay } from '@/lib/dates';
import { palette } from '@/theme/tokens';
import { pan } from '../../test-utils/gesture-mock';


const long = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
const bg = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { backgroundColor?: string }).backgroundColor;

type Opts = Partial<{
  mode: CalendarMode;
  myDays: Set<string>;
  counts: Map<string, number>;
  readOnly: boolean;
  selected: string | null;
  memberCount: number;
  who: Map<string, string[]>;
  people: Map<string, CalendarPerson>;
  to: string;
}>;

async function renderCalendar(opts: Opts = {}) {
  const onToggle = jest.fn();
  const onSelect = jest.fn();
  await render(
    <DayCalendar
      from="2027-03-10"
      to={opts.to ?? '2027-04-05'}
      today="2027-03-12"
      mode={opts.mode ?? 'mine'}
      myDays={opts.myDays ?? new Set()}
      counts={opts.counts ?? new Map()}
      memberCount={opts.memberCount ?? 3}
      selected={opts.selected ?? null}
      readOnly={opts.readOnly ?? false}
      onToggle={onToggle}
      onSelect={onSelect}
      who={opts.who}
      people={opts.people}
    />,
  );
  return { onToggle, onSelect };
}

describe('DayCalendar', () => {
  it('shows one month at a time and steps through them with the arrows', async () => {
    await renderCalendar({ to: '2027-05-20' });
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['March 2027']);
    const prev = screen.getByLabelText('Previous month');
    expect(prev.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByRole('header').props.children).toBe('April 2027');
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByRole('header').props.children).toBe('May 2027');
    expect(screen.getByLabelText('Next month').props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByLabelText('Back to this month'));
    expect(screen.getByRole('header').props.children).toBe('March 2027');
  });

  it('follows a swipe to another month', async () => {
    await renderCalendar();
    const list = screen.getByTestId('month-pager');
    const width = list.props.getItemLayout(null, 1).offset;
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: width, y: 0 } } });
    expect(screen.getByRole('header').props.children).toBe('April 2027');
  });

  it("doesn't flick back to the old month while an arrow's scroll is animating", async () => {
    await renderCalendar();
    const list = screen.getByTestId('month-pager');
    const width = list.props.getItemLayout(null, 1).offset;
    await fireEvent.press(screen.getByLabelText('Next month'));
    // The first frames of the animated scroll are still nearer March.
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: width * 0.2, y: 0 } } });
    expect(screen.getByRole('header').props.children).toBe('April 2027');
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: width, y: 0 } } });
    expect(screen.getByRole('header').props.children).toBe('April 2027');
    // Once it has landed, a swipe back works as usual.
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(screen.getByRole('header').props.children).toBe('March 2027');
  });

  it('counts my days in the month shown', async () => {
    await renderCalendar({ myDays: new Set(['2027-03-15', '2027-03-16', '2027-04-02']) });
    expect(screen.getByText('2 days marked this month')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByText('1 day marked this month')).toBeTruthy();
  });

  it('shows a dot per person in Everyone mode, and names them for screen readers', async () => {
    const people = new Map<string, CalendarPerson>([
      ['a', { name: 'You', color: '#111111' }],
      ['b', { name: 'Meera', color: '#222222' }],
      ['c', { name: 'Kabir', color: '#333333' }],
      ['d', { name: 'Zoya', color: '#444444' }],
    ]);
    const who = new Map([
      ['2027-03-15', ['a', 'b']],
      ['2027-03-16', ['a', 'b', 'c', 'd']],
    ]);
    await renderCalendar({ mode: 'all', memberCount: 4, counts: new Map([['2027-03-15', 2], ['2027-03-16', 4]]), who, people });
    expect(screen.getByLabelText(`${long('2027-03-15')}, 2 of 4 free: You, Meera`)).toBeTruthy();
    const two = screen.getByTestId('dots-2027-03-15');
    expect(two.children).toHaveLength(2);
    // More than three: two dots and "+2".
    expect(screen.getByTestId('dots-2027-03-16').children).toHaveLength(3);
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('shows no dots when names are hidden', async () => {
    await renderCalendar({ mode: 'all', counts: new Map([['2027-03-15', 2]]) });
    expect(screen.queryByTestId('dots-2027-03-15')).toBeNull();
  });

  it('shows no dots in Mine mode', async () => {
    await renderCalendar({ who: new Map([['2027-03-15', ['a']]]), people: new Map([['a', { name: 'You', color: '#111' }]]) });
    expect(screen.queryByTestId('dots-2027-03-15')).toBeNull();
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
    expect(cell).toBeSelected();
    expect(bg(cell)).toBe(palette.light.iris);
    expect(flat(cell)).toMatchObject({ height: 44, borderRadius: 14 });
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

  it('outlines my own days in ink and the selected day in iris in Everyone mode', async () => {
    await renderCalendar({ mode: 'all', myDays: new Set(['2027-03-15']), counts: new Map([['2027-03-15', 1]]), selected: '2027-03-16' });
    expect(flat(screen.getByLabelText(`${long('2027-03-15')}, you are free, 1 of 3 free`))).toMatchObject({ borderWidth: 2, borderColor: palette.light.ink });
    expect(flat(screen.getByLabelText(`${long('2027-03-16')}, 0 of 3 free`))).toMatchObject({ borderWidth: 2, borderColor: palette.light.iris });
  });

  it('selects a day in Everyone mode, even when read-only', async () => {
    const { onSelect, onToggle } = await renderCalendar({ mode: 'all', readOnly: true, selected: '2027-03-20' });
    expect(screen.getByLabelText(`${long('2027-03-20')}, 0 of 3 free`)).toBeSelected();
    await fireEvent.press(screen.getByLabelText(`${long('2027-03-15')}, 0 of 3 free`));
    expect(onSelect).toHaveBeenCalledWith('2027-03-15');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("doesn't divide by zero with no members", async () => {
    await renderCalendar({ mode: 'all', memberCount: 0, counts: new Map([['2027-03-15', 1]]) });
    expect(bg(screen.getByLabelText(`${long('2027-03-15')}, 1 of 0 free`))).toBe(palette.light.heat[3]);
  });
});


describe('DayCalendar drag to mark', () => {
  // March 2027 starts on a Monday, so day d sits in column (d-1) % 7, row floor((d-1) / 7).
  const at = (d: number, width: number) => {
    const col = (d - 1) % 7;
    const row = Math.floor((d - 1) / 7);
    const colWidth = (width - 6 * 4) / 7;
    return { x: col * (colWidth + 4) + colWidth / 2, y: row * 48 + 22 };
  };
  const pageWidth = () => screen.getByTestId('month-pager').props.getItemLayout(null, 1).offset as number;
  const run = async (fn: () => void) => act(async () => fn());

  it('only listens in Mine mode on an editable calendar, after a short hold', async () => {
    await renderCalendar();
    expect(pan.config?.enabled).toBe(true);
    expect(pan.config?.activateAfterLongPress).toBeGreaterThan(100);
    await renderCalendar({ mode: 'all' });
    expect(pan.config?.enabled).toBe(false);
    await renderCalendar({ readOnly: true });
    expect(pan.config?.enabled).toBe(false);
  });

  it('marks every day the finger crosses, once each', async () => {
    const { onToggle } = await renderCalendar();
    const w = pageWidth();
    await run(() => pan.config!.onActivate(at(15, w)));
    await run(() => pan.config!.onUpdate(at(17, w)));
    await run(() => pan.config!.onUpdate(at(17, w)));
    await run(() => pan.config!.onUpdate(at(18, w)));
    expect(onToggle.mock.calls).toEqual([
      ['2027-03-15', true],
      ['2027-03-16', true],
      ['2027-03-17', true],
      ['2027-03-18', true],
    ]);
  });

  it('clears days when the stroke starts on a marked day, and leaves clear days alone', async () => {
    const { onToggle } = await renderCalendar({ myDays: new Set(['2027-03-15', '2027-03-17']) });
    const w = pageWidth();
    await run(() => pan.config!.onActivate(at(15, w)));
    await run(() => pan.config!.onUpdate(at(17, w)));
    expect(onToggle.mock.calls).toEqual([
      ['2027-03-15', false],
      ['2027-03-17', false],
    ]);
  });

  it("doesn't touch past days or days outside the range", async () => {
    const { onToggle } = await renderCalendar();
    const w = pageWidth();
    // Today is 12 March: 11 is past, 12 is fine.
    await run(() => pan.config!.onActivate(at(13, w)));
    await run(() => pan.config!.onUpdate(at(10, w)));
    expect(onToggle.mock.calls).toEqual([
      ['2027-03-13', true],
      ['2027-03-12', true],
    ]);
  });

  it('ignores the tap the platform sends after a drag, then taps work again', async () => {
    jest.useFakeTimers();
    try {
      const { onToggle } = await renderCalendar();
      const w = pageWidth();
      await run(() => pan.config!.onActivate(at(15, w)));
      await run(() => pan.config!.onFinalize());
      onToggle.mockClear();
      await fireEvent.press(screen.getByLabelText(long('2027-03-15')));
      expect(onToggle).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await fireEvent.press(screen.getByLabelText(long('2027-03-16')));
      expect(onToggle).toHaveBeenCalledWith('2027-03-16', true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not block taps when a press never became a drag', async () => {
    const { onToggle } = await renderCalendar();
    await run(() => pan.config!.onFinalize());
    await fireEvent.press(screen.getByLabelText(long('2027-03-16')));
    expect(onToggle).toHaveBeenCalledWith('2027-03-16', true);
  });

  it('stops the pager scrolling while a stroke is in progress', async () => {
    await renderCalendar();
    const w = pageWidth();
    expect(screen.getByTestId('month-pager').props.scrollEnabled).toBe(true);
    await run(() => pan.config!.onActivate(at(15, w)));
    expect(screen.getByTestId('month-pager').props.scrollEnabled).toBe(false);
    await run(() => pan.config!.onFinalize());
    expect(screen.getByTestId('month-pager').props.scrollEnabled).toBe(true);
  });
});
