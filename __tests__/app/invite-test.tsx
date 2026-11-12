import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { queueResult } from '../../test-utils/supabase-mock';
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

  it('shows signed-out visitors the trip and keeps the code for after sign-in', async () => {
    queueResult('rpc:invite_preview', { data: [{ name: 'Goa in March', color: 'sunset', members: 2 }] });
    setParams({ code: ' goa2027 ' });
    await render(<Invite />);

    expect(await screen.findByText('Goa in March')).toBeTruthy();
    expect(screen.getByText('2 people are going')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Go to Huddle' })).toBeTruthy();
  });

  it('still lets them sign in when the preview cannot load', async () => {
    queueResult('rpc:invite_preview', { error: { message: 'Failed to fetch' } });
    setParams({ code: 'goa2027' });
    await render(<Invite />);

    expect(await screen.findByText('a trip on Huddle')).toBeTruthy();
    expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBe('goa2027');
    expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy();
  });
});
