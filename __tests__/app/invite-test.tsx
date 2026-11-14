import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { queueResult, supabase } from '../../test-utils/supabase-mock';
import { router, setParams } from '../../test-utils/expo-router-mock';

jest.mock('expo-router', () => ({
  ...require('../../test-utils/expo-router-mock'),
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = require('react-native');
    return <Text>{`Redirect ${JSON.stringify(href)}`}</Text>;
  },
}));

let mockSession: unknown = null;
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ session: mockSession }) }));

const Invite = require('@/app/invite/[code]').default as () => React.JSX.Element;

beforeEach(async () => {
  mockSession = null;
  await AsyncStorage.clear();
});

describe('Invite link', () => {
  it('sends signed-in people straight to the join sheet', async () => {
    mockSession = { user: { id: 'u1' } };
    setParams({ code: 'goa2027' });
    await render(<Invite />);
    expect(screen.getByText('Redirect {"pathname":"/join","params":{"code":"goa2027"}}')).toBeTruthy();
  });

  it('sends signed-in people home when the link has no code', async () => {
    mockSession = { user: { id: 'u1' } };
    setParams({});
    await render(<Invite />);
    expect(screen.getByText('Redirect "/"')).toBeTruthy();
  });

  it('shows a thinking Pip and a spinner while the invite loads', async () => {
    (supabase.rpc as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
    setParams({ code: 'goa2027' });
    await render(<Invite />);
    expect(screen.getByLabelText('Loading the invite')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Pip the penguin, thinking' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows signed-out visitors the trip and keeps the code for after sign-in', async () => {
    queueResult('rpc:invite_preview', { data: [{ name: 'Goa in March', color: 'coral', members: 2 }] });
    setParams({ code: ' goa2027 ' });
    await render(<Invite />);

    expect(await screen.findByText('Goa in March')).toBeTruthy();
    expect(screen.getByText('You’re invited to')).toBeTruthy();
    expect(screen.getByText('2 people are going')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Pip the penguin waving hello' })).toBeTruthy();
    // Pip's scarf takes the trip colour (coral); react-native-svg stores it as an ARGB integer.
    expect(JSON.stringify(screen.toJSON())).toContain(String((0xff000000 + 0xff8a4c) >>> 0));
    expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBe('goa2027');

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in to join' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('says so when the code matches no trip, and forgets it', async () => {
    queueResult('rpc:invite_preview', { data: [] });
    setParams({ code: 'nope' });
    await render(<Invite />);

    expect(await screen.findByText('This invite doesn’t work')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Huddle' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('still lets them sign in when the preview cannot load', async () => {
    queueResult('rpc:invite_preview', { error: { message: 'Failed to fetch' } });
    setParams({ code: 'goa2027' });
    await render(<Invite />);

    expect(await screen.findByText('a trip on Huddle')).toBeTruthy();
    expect(screen.queryByText(/people are going/)).toBeNull();
    expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBe('goa2027');
    expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy();
  });
});
