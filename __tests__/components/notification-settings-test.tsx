import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NotificationSettings } from '@/components/notification-settings';

import { notificationState } from '../../test-utils/notifications-mock';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

describe('NotificationSettings', () => {
  it('shows my saved choices and saves a change', async () => {
    queueResult('notification_prefs', { data: { invites: true, plans: true, nudges: false, joins: true } });
    await render(<NotificationSettings userId="u1" />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Nudges' }).props.value).toBe(false));
    await fireEvent(screen.getByRole('switch', { name: 'People joining' }), 'valueChange', false);
    const upsert = queriesFor('notification_prefs').at(-1)!.ops[0];
    expect(upsert[0]).toBe('upsert');
    expect(upsert[1][0]).toMatchObject({ user_id: 'u1', nudges: false, joins: false });
  });

  it('puts a switch back when saving fails', async () => {
    queueResult('notification_prefs', { data: null }, { error: { message: 'offline' } });
    await render(<NotificationSettings userId="u1" />);
    await fireEvent(screen.getByRole('switch', { name: 'Invites' }), 'valueChange', false);
    expect(await screen.findByText("Couldn't save that. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Invites' }).props.value).toBe(true);
  });

  it('points to Settings when push is off for Huddle', async () => {
    notificationState.permission = 'denied';
    await render(<NotificationSettings userId="u1" />);
    expect(await screen.findByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });
});
