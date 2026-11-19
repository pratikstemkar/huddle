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

const GroupInvite = require('@/app/group-invite/[code]').default as () => React.JSX.Element;

beforeEach(async () => {
  mockSession = null;
  await AsyncStorage.clear();
});

describe('Group join link', () => {
  it('sends signed-in people to the join screen with the code', async () => {
    mockSession = { user: { id: 'u1' } };
    setParams({ code: 'college1' });
    await render(<GroupInvite />);
    expect(screen.getByText('Redirect {"pathname":"/join","params":{"code":"college1"}}')).toBeTruthy();
  });

  it('shows signed-out visitors the group and keeps the code for after sign-in', async () => {
    queueResult('rpc:group_invite_preview', { data: [{ name: 'College gang', color: 'iris', members: 6 }] });
    setParams({ code: ' college1 ' });
    await render(<GroupInvite />);

    expect(await screen.findByText('College gang')).toBeTruthy();
    expect(screen.getByText('6 people so far')).toBeTruthy();
    expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBe('college1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in to join' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('says so when the code matches no group, and forgets it', async () => {
    queueResult('rpc:group_invite_preview', { data: [] });
    setParams({ code: 'nope' });
    await render(<GroupInvite />);
    expect(await screen.findByText('This link doesn’t work')).toBeTruthy();
    await waitFor(async () => expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBeNull());
  });
});
