import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { DateRangePicker, type DayRange } from '@/components/date-range-picker';
import { addDays, formatDay, fromDay, monthGrids, today, toDay } from '@/lib/dates';

const label = (day: string) => formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' });

function nextMonth(d: number) {
  const t = fromDay(today());
  return toDay(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, d)));
}

function Harness({ initial = null, onChange }: { initial?: DayRange | null; onChange: jest.Mock }) {
  const [value, setValue] = useState<DayRange | null>(initial);
  return (
    <DateRangePicker
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('DateRangePicker', () => {
  it('starts on this month with past days disabled and no way back', async () => {
    await render(<Harness onChange={jest.fn()} />);
    const month = monthGrids(today(), today())[0].label;
    expect(screen.getByText(month)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous month' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Tap the first day, then the last')).toBeTruthy();
    const yesterday = addDays(today(), -1);
    if (yesterday.slice(0, 7) === today().slice(0, 7)) {
      expect(screen.getByRole('button', { name: label(yesterday) }).props.accessibilityState).toMatchObject({ disabled: true });
    }
  });

  it('picks the first day, then the last', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: label(nextMonth(10)) }));
    expect(onChange).toHaveBeenLastCalledWith({ start: nextMonth(10), end: nextMonth(10) });
    expect(screen.getByText(/now tap the last day/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: label(nextMonth(13)) }));
    expect(onChange).toHaveBeenLastCalledWith({ start: nextMonth(10), end: nextMonth(13) });
    expect(screen.getByRole('button', { name: `${label(nextMonth(10))}, first day` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `${label(nextMonth(11))}, in your dates` }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: `${label(nextMonth(13))}, last day` })).toBeTruthy();
    expect(screen.getByRole('button', { name: label(nextMonth(14)) }).props.accessibilityState).toMatchObject({ selected: false });
  });

  it('orders the days when the last tap is earlier', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: label(nextMonth(20)) }));
    await fireEvent.press(screen.getByRole('button', { name: label(nextMonth(5)) }));
    expect(onChange).toHaveBeenLastCalledWith({ start: nextMonth(5), end: nextMonth(20) });
  });

  it('opens on the month of an existing range and starts over on the next tap', async () => {
    const onChange = jest.fn();
    await render(<Harness initial={{ start: nextMonth(3), end: nextMonth(6) }} onChange={onChange} />);
    expect(screen.getByRole('button', { name: `${label(nextMonth(3))}, first day` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: `${label(nextMonth(5))}, in your dates` }));
    expect(onChange).toHaveBeenLastCalledWith({ start: nextMonth(5), end: nextMonth(5) });
  });
});
