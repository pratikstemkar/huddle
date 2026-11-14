import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockAuth = {
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signInAsDevUser: jest.fn(),
};

jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-apple-authentication', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel="Continue with Apple" onPress={onPress}>
        <RNText>Apple</RNText>
      </Pressable>
    ),
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
  };
});

let mockDevAuth = true;
let mockConfigured = true;
jest.mock('@/lib/dev-auth', () => ({
  get devAuthEnabled() {
    return mockDevAuth;
  },
  DEV_USERS: [
    { name: 'Aarav', email: 'aarav@dev.test', color: '#f00' },
    { name: 'Meera', email: 'meera@dev.test', color: '#0f0' },
  ],
}));
jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockConfigured;
  },
}));

const { router } = require('../../test-utils/expo-router-mock') as typeof import('../../test-utils/expo-router-mock');
const SignIn = require('@/app/sign-in').default as () => React.JSX.Element;

function withOS<T>(os: string, fn: () => Promise<T>) {
  const prev = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return fn().finally(() => Object.defineProperty(Platform, 'OS', { value: prev, configurable: true }));
}

describe('Sign in screen', () => {
  beforeEach(() => {
    mockDevAuth = true;
    mockConfigured = true;
    for (const fn of Object.values(mockAuth)) fn.mockReset().mockResolvedValue(undefined);
  });

  it('shows the pitch and the sign-in options', async () => {
    await render(<SignIn />);
    expect(screen.getByText('Plan the trip, not the group chat.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.queryByText('Supabase isn’t set up yet')).toBeNull();
  });

  it('links to the privacy policy', async () => {
    await render(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy policy' }));
    expect(router.push).toHaveBeenCalledWith('/privacy');
  });

  it('signs in with Google', async () => {
    await render(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(mockAuth.signInWithGoogle).toHaveBeenCalled();
  });

  it('shows the error message when sign-in fails, and clears it on retry', async () => {
    mockAuth.signInWithGoogle.mockRejectedValueOnce(new Error('Popup closed'));
    await render(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText('Popup closed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(screen.queryByText('Popup closed')).toBeNull());
  });

  it('falls back to a generic message for errors without one', async () => {
    mockAuth.signInWithGoogle.mockRejectedValueOnce({});
    await render(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });

  it('offers Apple on iOS only', async () => {
    await withOS('ios', async () => {
      await render(<SignIn />);
      await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
      expect(mockAuth.signInWithApple).toHaveBeenCalled();
    });
    await withOS('android', async () => {
      await render(<SignIn />);
      expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    });
  });

  it('signs in as a developer user', async () => {
    await render(<SignIn />);
    expect(screen.getByText('Developer sign-in (local Supabase only)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in as Meera' }));
    expect(mockAuth.signInAsDevUser).toHaveBeenCalledWith('meera@dev.test');
  });

  it('hides developer sign-in when it is off', async () => {
    mockDevAuth = false;
    await render(<SignIn />);
    expect(screen.queryByRole('button', { name: /Sign in as/ })).toBeNull();
  });

  it('warns when Supabase is not configured', async () => {
    mockConfigured = false;
    await render(<SignIn />);
    expect(screen.getByText('Supabase isn’t set up yet')).toBeTruthy();
  });
});
