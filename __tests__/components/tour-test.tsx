import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { tripSteps, type TourStep } from '@/components/tour/steps';
import { TourProvider, useAutoTour, useTour, useTourTarget } from '@/components/tour/tour';
import { loadToursSeen } from '@/lib/tour-seen';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

// Layout doesn't run in tests: every target sits in view.
jest.mock('@/components/tour/measure', () => ({
  measureInWindow: jest.fn(async () => ({ x: 0, y: 0, w: 60, h: 40 })),
}));

const STEPS: TourStep[] = [
  { target: 'a', title: 'First thing', text: 'What a does.' },
  { target: 'gone', title: 'Not on screen', text: 'Skipped.' },
  { target: 'b', title: 'Second thing', text: 'What b does.' },
];

const SLOW = { timeout: 3000 };

function Target({ id }: { id: string }) {
  const t = useTourTarget(id);
  return <View {...t} testID={`target-${id}`} />;
}

function Screen({ ready = true, steps = STEPS }: { ready?: boolean; steps?: TourStep[] }) {
  useAutoTour('home', steps, ready);
  const { replay, active } = useTour();
  return (
    <>
      <Target id="a" />
      <Target id="b" />
      <Text>{active ? 'touring' : 'idle'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="replay" onPress={replay} />
    </>
  );
}

async function renderTour(props?: { ready?: boolean; steps?: TourStep[] }) {
  return render(
    <TourProvider>
      <Screen {...props} />
    </TourProvider>,
  );
}

describe('guided tour', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('plays once on a new device, skipping steps whose target is missing', async () => {
    await renderTour();
    expect(await screen.findByText('First thing', {}, SLOW)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Second thing')).toBeTruthy();
    expect(screen.queryByText('Not on screen')).toBeNull();
    // Last step: no Skip, and the button ends the tour.
    expect(screen.queryByRole('button', { name: 'Skip tour' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByTestId('tour-overlay')).toBeNull());
    await waitFor(async () => expect((await loadToursSeen()).home).toBe(true));
    expect((await loadToursSeen()).trip).toBe(false);
  });

  it('Skip ends it and remembers', async () => {
    await renderTour();
    await screen.findByText('First thing', {}, SLOW);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(screen.getByText('idle')).toBeTruthy());
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.tour.home')).toBe('1'));
  });

  it('stays away once seen, and comes back after a replay', async () => {
    await AsyncStorage.setItem('huddle.tour.home', '1');
    await renderTour();
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'replay' }));
    expect(await screen.findByText('First thing', {}, SLOW)).toBeTruthy();
    expect(await AsyncStorage.getItem('huddle.tour.home')).toBeNull();
  });

  it('waits until the screen is ready', async () => {
    await renderTour({ ready: false });
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByTestId('tour-overlay')).toBeNull();
  });
});

describe('trip tour steps', () => {
  it('points organisers at the lock, and tells members who locks', () => {
    const organiser = tripSteps(true);
    const member = tripSteps(false);
    expect(organiser.map((s) => s.target)).toContain('trip.next');
    expect(member.map((s) => s.target)).not.toContain('trip.next');
    expect(member.find((s) => s.target === 'trip.tab.plan')?.text).toMatch(/organiser locks/);
    // Same order either way: vote, then plan, split, photos.
    const order = member.map((s) => s.target);
    expect(order.indexOf('trip.tab.vote')).toBeLessThan(order.indexOf('trip.tab.plan'));
    expect(order.indexOf('trip.tab.plan')).toBeLessThan(order.indexOf('trip.tab.split'));
  });
});
