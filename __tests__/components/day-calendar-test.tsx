import * as Haptics from 'expo-haptics';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DayCalendar, type CalendarMode, type CalendarPerson } from '@/components/day-calendar';
import { formatDay } from '@/lib/dates';
import { palette } from '@/theme/tokens';


const long = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });
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
