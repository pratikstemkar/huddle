import { fireEvent, render, screen } from '@testing-library/react-native';

import { router } from '../../test-utils/expo-router-mock';
import { queueResult, rpcCalls, supabase } from '../../test-utils/supabase-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

const DeleteAccount = require('@/app/(app)/delete-account').default as () => React.JSX.Element;

const preview = [
  { trip_id: 't1', trip_name: 'Goa in March', outcome: 'handed_over', new_organiser: 'Meera' },
  { trip_id: 't2', trip_name: 'Solo', outcome: 'deleted', new_organiser: null },
];

describe('Delete account', () => {
  it('lists what happens to each trip', async () => {
    queueResult('rpc:account_deletion_preview', { data: preview });
    await render(<DeleteAccount />);
    expect(await screen.findByText('Goa in March passes to Meera as organiser.')).toBeTruthy();
    expect(screen.getByText('Solo will be deleted. Nobody else is in it.')).toBeTruthy();
  });

  it('says so when I have no trips', async () => {
    queueResult('rpc:account_deletion_preview', { data: [] });
    await render(<DeleteAccount />);
    expect(await screen.findByText('You’re not in any trips.')).toBeTruthy();
  });

  it('needs DELETE typed before it deletes anything', async () => {
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delet');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Type DELETE to confirm.')).toBeTruthy();
    expect(rpcCalls.map((c) => c.name)).not.toContain('delete_my_account');
  });

  it('deletes and signs out once confirmed', async () => {
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), ' delete ');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(rpcCalls.map((c) => c.name)).toContain('delete_my_account');
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('shows the error and keeps the account when deleting fails', async () => {
    queueResult('rpc:delete_my_account', { error: { message: 'offline' } });
    await render(<DeleteAccount />);
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText("Couldn't delete your account. Check your connection and try again.")).toBeTruthy();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('backs out without deleting', async () => {
    await render(<DeleteAccount />);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));
    expect(router.back).toHaveBeenCalled();
    expect(rpcCalls.map((c) => c.name)).not.toContain('delete_my_account');
  });
});
