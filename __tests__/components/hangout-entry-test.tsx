import { fireEvent, render, screen } from '@testing-library/react-native';

import { router } from '../../test-utils/expo-router-mock';
import { GroupCard } from '@/components/groups/group-card';
import { HangoutInviteRow } from '@/components/groups/invite-row';
import type { GroupCard as GroupCardData } from '@/lib/groups';
import type { HangoutListItem } from '@/lib/hangouts';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

const group: GroupCardData = { id: 'g1', name: 'College gang', color: 'iris', invite_code: 'c', created_at: '', members: 6, trips: 1, myRole: 'admin', faces: [], justJoined: false };
const hangout: HangoutListItem = {
  id: 'h1',
  name: 'Dinner with the gang',
  kind: 'dinner',
  mode: 'find',
  status: 'open',
  group_id: 'g1',
  group_name: 'College gang',
  from: 'Aarav',
  organiser: false,
  answered: false,
  starts_at: null,
  created_at: '',
};

describe('hangout entry points', () => {
  it('plans a hangout with a group from its card', async () => {
    await render(<GroupCard group={group} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Plan a hangout with College gang' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/new-hangout', params: { group: 'g1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Start a trip with College gang' }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/new-trip', params: { group: 'g1' } });
  });

  it('asks me to answer a hangout under Waiting on you', async () => {
    const onOpen = jest.fn();
    await render(<HangoutInviteRow hangout={hangout} onOpen={onOpen} />);
    expect(screen.getByText(/asked when works for Dinner with the gang/)).toBeTruthy();
    expect(screen.getByText('Hangout · College gang')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Answer: Dinner with the gang' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('words an I’ll-pick-it hangout as an invite', async () => {
    await render(<HangoutInviteRow hangout={{ ...hangout, mode: 'set' }} onOpen={jest.fn()} />);
    expect(screen.getByText(/invited you to Dinner with the gang/)).toBeTruthy();
  });
});
