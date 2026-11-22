import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { ActivityItem } from '@/lib/activity';

import { router } from '../../test-utils/expo-router-mock';
import { sessionFor } from '../../test-utils/fixtures';
import { notifications, notificationState } from '../../test-utils/notifications-mock';
import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

let mockSession: unknown;
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  useAuth: () => ({ session: mockSession }),
}));

const Activity = require('@/app/(app)/activity').default as () => React.JSX.Element;

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  id: 'n1',
  kind: 'trip_locked',
  title: 'Goa is happening',
  body: 'Palolem · 12–15 Mar',
  url: '/trip/t1',
  created_at: new Date().toISOString(),
  read_at: null,
  ...over,
});

beforeEach(() => {
  mockSession = sessionFor('u1');
});

describe('Activity', () => {
  it('lists what happened, unread first in the label', async () => {
    queueResult('notifications', { data: [item(), item({ id: 'n2', kind: 'nudge_vote', title: 'Goa: vote on where to go', body: 'Asha nudged everyone.', read_at: new Date().toISOString() })] });
    await render(<Activity />);
    expect(await screen.findByRole('button', { name: /^Unread\. Goa is happening\. Palolem/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Goa: vote on where to go/ })).toBeTruthy();
  });

  it('opens the item and marks it read', async () => {
    queueResult('notifications', { data: [item()] });
    await render(<Activity />);
    await fireEvent.press(await screen.findByRole('button', { name: /Goa is happening/ }));
    expect(router.push).toHaveBeenCalledWith('/trip/t1');
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: ['n1'] } });
  });

  it('opens a release item in the browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const url = 'https://github.com/pratikstemkar/huddle/releases/tag/v1.4.0';
    queueResult('notifications', {
      data: [item({ kind: 'app_release', title: 'Huddle 1.4.0 needs a new download', body: 'Tap to download the new app and install it over this one.', url })],
    });
    await render(<Activity />);
    await fireEvent.press(await screen.findByRole('button', { name: /Huddle 1\.4\.0 needs a new download/ }));
    expect(open).toHaveBeenCalledWith(url);
    expect(router.push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('marks everything read', async () => {
    queueResult('notifications', { data: [item(), item({ id: 'n2' })] });
    await render(<Activity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mark all read' }));
    expect(rpcCalls).toContainEqual({ name: 'mark_notifications_read', args: { ids: null } });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull());
  });

  it('says when there is nothing yet', async () => {
    queueResult('notifications', { data: [] });
    await render(<Activity />);
    expect(await screen.findByText('Nothing yet. Invites, nudges and locked plans show up here.')).toBeTruthy();
  });

  it('offers to turn on push when it was never asked', async () => {
    notificationState.permission = 'undetermined';
    queueResult('notifications', { data: [] });
    await render(<Activity />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on notifications' }));
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Turn on notifications' })).toBeNull());
  });

  it('points to Settings when push was turned off', async () => {
    notificationState.permission = 'denied';
    queueResult('notifications', { data: [] });
    await render(<Activity />);
    expect(await screen.findByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it('shows nothing about push once it is on', async () => {
    queueResult('notifications', { data: [] });
    await render(<Activity />);
    await screen.findByText(/Nothing yet/);
    expect(screen.queryByText('Get these on your phone')).toBeNull();
  });
});
