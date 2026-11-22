import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { IntroSeenProvider, loadIntroSeen, saveJoinAfterSignIn, takeJoinAfterSignIn, useIntroSeen } from '@/lib/intro-seen';

function Probe() {
  const { seen, loaded, markSeen } = useIntroSeen();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="mark" onPress={markSeen}>
      <Text>{loaded ? (seen ? 'seen' : 'new') : 'loading'}</Text>
    </Pressable>
  );
}

describe('intro seen flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is unset on a fresh install', async () => {
    expect(await loadIntroSeen()).toBe(false);
    await render(
      <IntroSeenProvider>
        <Probe />
      </IntroSeenProvider>,
    );
    expect(await screen.findByText('new')).toBeTruthy();
  });

  it('remembers once marked seen', async () => {
    await render(
      <IntroSeenProvider>
        <Probe />
      </IntroSeenProvider>,
    );
    await screen.findByText('new');
    await fireEvent.press(screen.getByRole('button', { name: 'mark' }));
    expect(screen.getByText('seen')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.introSeen')).toBe('1'));
    expect(await loadIntroSeen()).toBe(true);
  });

  it('reads a saved flag on start', async () => {
    await AsyncStorage.setItem('huddle.introSeen', '1');
    await render(
      <IntroSeenProvider>
        <Probe />
      </IntroSeenProvider>,
    );
    expect(await screen.findByText('seen')).toBeTruthy();
  });

  it('hands over the join request once', async () => {
    expect(await takeJoinAfterSignIn()).toBe(false);
    await saveJoinAfterSignIn();
    expect(await takeJoinAfterSignIn()).toBe(true);
    expect(await takeJoinAfterSignIn()).toBe(false);
  });
});
