import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemePreferenceProvider } from '@/theme/theme-preference';

import { router } from '../../test-utils/expo-router-mock';
import { sessionFor } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));

const mockSignOut = jest.fn();
let mockSession: unknown;
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  useAuth: () => ({ session: mockSession, signOut: mockSignOut }),
}));

let mockState: { profile: unknown; loading: boolean; error: null; refresh: jest.Mock };
jest.mock('@/lib/profile', () => ({
  ...jest.requireActual('@/lib/profile'),
  useMyProfile: () => mockState,
  updateProfile: jest.fn(),
}));

const { updateProfile } = require('@/lib/profile') as { updateProfile: jest.Mock };
const ProfileScreen = require('@/app/(app)/(home)/profile').default as () => React.JSX.Element;

const me = { id: 'u1', display_name: 'Aarav Shah', avatar_url: null, avatar_color: null };

describe('Profile', () => {
  beforeEach(() => {
    mockSession = sessionFor('u1', 'Aarav Shah');
    mockState = { profile: me, loading: false, error: null, refresh: jest.fn() };
  });

  it('loads on focus and shows a spinner first', async () => {
    mockState = { ...mockState, profile: null, loading: true };
    await render(<ProfileScreen />);
    expect(screen.getByLabelText('Loading your profile')).toBeTruthy();
    expect(mockState.refresh).toHaveBeenCalled();
  });

  it('shows who I am signed in as and the app version', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Signed in as aarav@dev.test')).toBeTruthy();
    expect(screen.getByText('Huddle 1.0.1')).toBeTruthy();
  });

  it('saves a new name and colour, and stays on the tab', async () => {
    updateProfile.mockResolvedValue(undefined);
    await render(<ProfileScreen />);
    const input = screen.getByLabelText('Your name');
    expect(input.props.value).toBe('Aarav Shah');
    await fireEvent.changeText(input, '  Aarav  ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Blush' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(updateProfile).toHaveBeenCalledWith('u1', { display_name: 'Aarav', avatar_color: 'blush' });
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(mockState.refresh).toHaveBeenCalledTimes(2);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('caps the name at 40 characters', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByLabelText('Your name').props.maxLength).toBe(40);
  });

  it('needs a name', async () => {
    await render(<ProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your name'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(screen.getByText('Add your name first.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('shows an error when saving fails', async () => {
    updateProfile.mockRejectedValue(new Error('offline'));
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText("Couldn't save your profile. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('can swap a sign-in photo for my initial', async () => {
    mockState.profile = { ...me, avatar_url: 'https://photo.png' };
    updateProfile.mockResolvedValue(undefined);
    await render(<ProfileScreen />);
    expect(screen.queryByRole('radio', { name: 'Mint' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Use my initial instead' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mint' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(updateProfile).toHaveBeenCalledWith('u1', { display_name: 'Aarav Shah', avatar_color: 'mint', avatar_url: null });
  });

  it('switches the app theme and remembers it', async () => {
    await AsyncStorage.clear();
    await render(
      <ThemePreferenceProvider>
        <ProfileScreen />
      </ThemePreferenceProvider>,
    );
    expect(await screen.findByRole('tab', { name: 'System', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByRole('tab', { name: 'Dark', selected: true })).toBeTruthy();
    expect(await AsyncStorage.getItem('huddle.theme')).toBe('dark');
  });

  it('signs out', async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('links to the privacy policy and account deletion', async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy policy' }));
    expect(router.push).toHaveBeenCalledWith('/privacy');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(router.push).toHaveBeenCalledWith('/delete-account');
  });
});
