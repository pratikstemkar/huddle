import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { WelcomeScene } from '@/components/welcome-scene';

const CLOUD = 'M18 36a14 14 0 0 1 4-27 18 18 0 0 1 34 2 12 12 0 0 1 22 9 9 9 0 0 1 4 16z';
const clouds = () => screen.getAllByTestId('welcome-cloud', { includeHiddenElements: true });
const translateX = (el: { props: { jestAnimatedStyle?: { value: { transform: { translateX: number }[] } } } }) =>
  el.props.jestAnimatedStyle?.value.transform[0].translateX;
/** react-native-svg stores colours as ARGB integers. */
const svgColor = (hex: string) => String((0xff000000 + parseInt(hex.slice(1), 16)) >>> 0);

// Every Pip layer and both clouds animate, so each fake-timer step renders many frames; CI runs with coverage on.
jest.setTimeout(20000);

describe('WelcomeScene', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows Pip waving hello above the sheet content', async () => {
    await render(
      <WelcomeScene>
        <Text>Sheet content</Text>
      </WelcomeScene>,
    );
    expect(screen.getByRole('image', { name: 'Pip the penguin waving hello' })).toBeTruthy();
    expect(screen.getByText('Sheet content')).toBeTruthy();
  });

  it('draws two decorative clouds hidden from screen readers', async () => {
    await render(
      <WelcomeScene>
        <Text>x</Text>
      </WelcomeScene>,
    );
    expect(clouds()).toHaveLength(2);
    expect(screen.queryAllByTestId('welcome-cloud')).toHaveLength(0);
    expect(JSON.stringify(screen.toJSON())).toContain(CLOUD);
  });

  it('holds the clouds still under reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(
      <WelcomeScene>
        <Text>x</Text>
      </WelcomeScene>,
    );
    await waitFor(() => expect(clouds().map(translateX)).toEqual([0, 0]));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(clouds().map(translateX)).toEqual([0, 0]);
  });

  it('takes a scarf colour and a different mood', async () => {
    await render(
      <WelcomeScene pipMood="hmm" pipLabel="Pip thinking" scarf="#3CC5A5">
        <Text>x</Text>
      </WelcomeScene>,
    );
    expect(screen.getByRole('image', { name: 'Pip thinking' })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(svgColor('#3CC5A5'));
  });

  // Runs last: its endless animations live on fake timers, so it unmounts before timers go back to real ones.
  it('drifts the clouds', async () => {
    jest.useFakeTimers();
    const { unmount } = await render(
      <WelcomeScene>
        <Text>x</Text>
      </WelcomeScene>,
    );
    const before = clouds().map(translateX);
    await act(async () => jest.advanceTimersByTime(500));
    const after = clouds().map(translateX);
    expect(after[0]).not.toEqual(before[0]);
    await unmount();
    jest.clearAllTimers();
  });
});
