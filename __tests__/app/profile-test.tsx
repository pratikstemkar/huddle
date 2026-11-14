import { fireEvent, render, screen } from '@testing-library/react-native';

import { router } from '../../test-utils/expo-router-mock';
import { sessionFor } from '../../test-utils/fixtures';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

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
const ProfileScreen = require('@/app/(app)/profile').default as () => React.JSX.Element;

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

  it('saves a new name and colour, then closes', async () => {
    updateProfile.mockResolvedValue(undefined);
    await render(<ProfileScreen />);
    const input = screen.getByLabelText('Your name');
    expect(input.props.value).toBe('Aarav Shah');
    await fireEvent.changeText(input, '  Aarav  ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Plum' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(updateProfile).toHaveBeenCalledWith('u1', { display_name: 'Aarav', avatar_color: 'plum' });
    expect(router.back).toHaveBeenCalled();
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
    expect(router.back).not.toHaveBeenCalled();
  });

  it('can swap a sign-in photo for my initial', async () => {
    mockState.profile = { ...me, avatar_url: 'https://photo.png' };
    updateProfile.mockResolvedValue(undefined);
    await render(<ProfileScreen />);
    expect(screen.queryByRole('radio', { name: 'Sky' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Use my initial instead' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sky' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));
    expect(updateProfile).toHaveBeenCalledWith('u1', { display_name: 'Aarav Shah', avatar_color: 'sky', avatar_url: null });
  });

  it('signs out', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('Signed in as aarav@dev.test')).toBeTruthy();
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
