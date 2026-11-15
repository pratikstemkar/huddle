import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { PipButton } from '@/components/nav/pip-button';
import { Pip } from '@/components/pip/pip';

const FLIP_R_UP = 'M90 70C100 62 110 48 116 30C118 24 113 22 109 26C102 34 96 44 90 52Z';
const FLIP_L_UP = 'M30 70C20 62 10 48 4 30C2 24 7 22 11 26C18 34 24 44 30 52Z';
const BEAK_OPEN = 'M51 54q9-6 18 0q-9 14-18 0z';
const SCARF = 'M27 68q33 12 66 0l2 9q-35 13-70 0z';
const CLOSED_EYES = 'M41 48q5 4 10 0M69 48q5 4 10 0';

const tree = () => JSON.stringify(screen.toJSON());
const rotations = () => [...tree().matchAll(/"rotate":"(-?[\d.e-]+)deg"/g)].map((m) => Number(m[1]));
const pip = (mood: string) => screen.getByTestId(`pip-${mood}`, { includeHiddenElements: true });

describe('Pip', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('idles by default, decorative unless labelled', async () => {
    await render(<Pip />);
    expect(pip('idle').props['aria-hidden']).toBe(true);
    expect(tree()).toContain(SCARF);
    expect(tree()).not.toContain(FLIP_R_UP);

    await render(<Pip accessibilityLabel="Pip waving hello" mood="hello" />);
    expect(screen.getByRole('image', { name: 'Pip waving hello' })).toBeTruthy();
  });

  it('sizes itself from the crop', async () => {
    await render(<Pip size={120} />);
    expect(pip('idle').props.style).toEqual(expect.arrayContaining([{ width: 120, height: 124 }]));
    await render(<Pip size={56} crop="peek" />);
    expect(pip('idle').props.style).toEqual(expect.arrayContaining([{ width: 56, height: (56 * 76) / 100 }]));
  });

  it('waves hello, then settles back to idle', async () => {
    const onSettled = jest.fn();
    await render(<Pip mood="hello" onSettled={onSettled} />);
    expect(pip('hello')).toBeTruthy();
    expect(tree()).toContain(FLIP_R_UP);
    expect(tree()).toContain(BEAK_OPEN);
    await act(async () => jest.advanceTimersByTime(400));
    expect(rotations().some((r) => r !== 0)).toBe(true);
    await act(async () => jest.advanceTimersByTime(2200));
    expect(onSettled).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(200));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(pip('idle')).toBeTruthy();
    expect(tree()).not.toContain(FLIP_R_UP);
  });

  it('cheers with both flippers and replays on demand', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onSettled = jest.fn();
    const { rerender } = await render(<Pip mood="yay" onSettled={onSettled} />);
    await act(async () => {});
    expect(tree()).toContain(FLIP_L_UP);
    expect(tree()).toContain(FLIP_R_UP);
    await act(async () => jest.advanceTimersByTime(3200));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(pip('idle')).toBeTruthy();

    await rerender(<Pip mood="yay" replay={1} onSettled={onSettled} />);
    expect(pip('yay')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(3200));
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it('keeps looping moods running', async () => {
    const onSettled = jest.fn();
    await render(<Pip mood="snooze" onSettled={onSettled} />);
    expect(tree()).toContain(CLOSED_EYES);
    await act(async () => jest.advanceTimersByTime(4000));
    expect(pip('snooze')).toBeTruthy();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('holds still and only swaps poses with reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onSettled = jest.fn();
    await render(<Pip mood="snooze" />);
    await act(async () => {});
    expect(tree()).toContain(CLOSED_EYES);
    expect(tree().match(/"z"/g)).toHaveLength(1);

    await render(<Pip mood="hello" onSettled={onSettled} />);
    await act(async () => {});
    expect(tree()).toContain(FLIP_R_UP);
    expect(tree()).toContain(BEAK_OPEN);
    await act(async () => jest.advanceTimersByTime(400));
    expect(rotations().every((r) => r === 0)).toBe(true);
    await act(async () => jest.advanceTimersByTime(2300));
    expect(onSettled).toHaveBeenCalled();
  });

  it('draws the shades pose and the nav-button bust', async () => {
    await render(<Pip shades wavePose />);
    expect(tree()).toContain('M57 45h6');
    expect(tree()).toContain('"cx":106,"cy":50');
    await render(<Pip crop="peek" size={56} />);
    expect(tree()).not.toContain(SCARF);
  });
});

describe('PipButton', () => {
  it('is a labelled button that runs its action', async () => {
    const onPress = jest.fn();
    await render(<PipButton accessibilityLabel="Pip: start a new trip" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pip: start a new trip' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('just bobs without an action', async () => {
    await render(<PipButton accessibilityLabel="Ask Pip" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ask Pip' }));
  });
});
