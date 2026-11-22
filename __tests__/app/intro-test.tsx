import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { IntroSeenProvider } from '@/lib/intro-seen';

import { notifications, notificationState } from '../../test-utils/notifications-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

const { router } = require('../../test-utils/expo-router-mock') as typeof import('../../test-utils/expo-router-mock');
const Intro = require('@/app/intro').default as () => React.JSX.Element;

// Every page has an animated Pip; CI runs with coverage on.
jest.setTimeout(20000);

const TITLES = [
  'Trips with your people, minus the group-chat chaos',
  'Pick when and where, together',
  'Plan every day, or just a quick hangout',
  'Split costs without the maths',
  'Every photo in one shared album',
  'Ready when your people are',
];

async function open() {
  await render(
    <IntroSeenProvider>
      <Intro />
    </IntroSeenProvider>,
  );
}

/** Only the page on screen is readable; the others are hidden from screen readers. */
const onPage = (i: number) => screen.getByRole('header', { name: TITLES[i] });

async function nextUntil(page: number) {
  await fireEvent.press(screen.getByRole('button', { name: 'Show me around' }));
  for (let i = 1; i < page; i++) await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
}

describe('First-open intro', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('opens with Pip saying hello, and only the first page is read out', async () => {
    await open();
    expect(onPage(0)).toBeTruthy();
    expect(screen.getByText('Hi, I’m Pip.')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 6')).toBeTruthy();
    for (const title of TITLES.slice(1)) expect(screen.queryByRole('header', { name: title })).toBeNull();
    expect(screen.getAllByTestId('pip-hello', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('walks through every page with Next and back with Back', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Show me around' }));
    expect(onPage(1)).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 6')).toBeTruthy();
    expect(screen.getByText(/Everyone taps the days they’re free/)).toBeTruthy();
    for (let i = 2; i < TITLES.length; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
      expect(onPage(i)).toBeTruthy();
      expect(screen.queryByRole('header', { name: TITLES[i - 1] })).toBeNull();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onPage(4)).toBeTruthy();
  });

  it('plays a mood on the page that arrives and rests Pip on the others', async () => {
    await open();
    await nextUntil(1);
    expect(screen.getByTestId('pip-hmm', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByTestId('pip-hmm', { includeHiddenElements: true })).toBeNull();
  });

  it.each([
    ['Skip on a feature page', async () => {
      await nextUntil(2);
      await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    }],
    ['Skip on the first page', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    }],
    ['I already have an account', async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
    }],
    ['Get started', async () => {
      await nextUntil(5);
      await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    }],
  ])('%s goes to sign in and never shows the intro again', async (_, act) => {
    await open();
    await act();
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.introSeen')).toBe('1'));
    expect(await AsyncStorage.getItem('huddle.joinAfterSignIn')).toBeNull();
  });

  it('“I have an invite code” asks for the join screen after sign-in', async () => {
    await open();
    await nextUntil(5);
    await fireEvent.press(screen.getByRole('button', { name: 'I have an invite code' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.joinAfterSignIn')).toBe('1'));
    expect(await AsyncStorage.getItem('huddle.introSeen')).toBe('1');
  });

  describe('on a phone that has not been asked about notifications', () => {
    const NOTIFY = 'Know the moment the plan moves';
    const notifyPage = () => screen.getByRole('header', { name: NOTIFY });

    beforeEach(() => {
      notificationState.permission = 'undetermined';
    });

    async function openWithNotify() {
      await open();
      await waitFor(() => expect(screen.getByLabelText('Step 1 of 7')).toBeTruthy());
    }

    it('asks before Ready, and Turn on shows the system prompt then goes to Ready', async () => {
      await openWithNotify();
      await nextUntil(5);
      expect(notifyPage()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
      expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(onPage(5)).toBeTruthy());
      expect(await AsyncStorage.getItem('huddle.pushAsked')).toBe('1');
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('Not now goes to Ready without the system prompt, so a trip can still ask later', async () => {
      await openWithNotify();
      await nextUntil(5);
      await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
      expect(onPage(5)).toBeTruthy();
      expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('huddle.pushAsked')).toBeNull();
    });

    it('Skip still stops at notifications, then goes straight to sign in', async () => {
      await openWithNotify();
      await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
      expect(notifyPage()).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
      expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });
  });

  it.each(['granted', 'denied'] as const)('leaves the notifications page out when permission is already %s', async (permission) => {
    notificationState.permission = permission;
    await open();
    await nextUntil(5);
    expect(onPage(5)).toBeTruthy();
    expect(screen.getByLabelText('Step 6 of 6')).toBeTruthy();
    expect(screen.queryByText('Know the moment the plan moves', { includeHiddenElements: true })).toBeNull();
  });
});
