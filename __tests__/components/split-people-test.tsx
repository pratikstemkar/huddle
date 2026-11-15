import { renderHook, waitFor } from '@testing-library/react-native';

import { useMoneyNames } from '@/components/split/people';
import type { Expense, Settlement } from '@/lib/split';
import type { TripMember } from '@/lib/trips';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

const member = (user_id: string, display_name: string) => ({ user_id, display_name }) as TripMember;
const expense = (paid_by: string, shareIds: string[]) =>
  ({ id: 'e1', paid_by, shares: shareIds.map((user_id) => ({ user_id, share_minor: 100 })) }) as unknown as Expense;
const settlement = (from_user: string, to_user: string) => ({ id: 's1', from_user, to_user }) as unknown as Settlement;

describe('useMoneyNames', () => {
  it('uses first names of current members without asking the database', async () => {
    const members = [member('me', 'Aarav Shah'), member('m2', 'Meera')];
    const { result } = await renderHook(() => useMoneyNames(members, [expense('me', ['me', 'm2'])], []));
    expect(result.current.get('me')).toBe('Aarav');
    expect(result.current.get('m2')).toBe('Meera');
    await waitFor(() => expect(queriesFor('profiles')).toHaveLength(0));
  });

  it('looks up people who left but still paid, owe or were paid', async () => {
    queueResult('profiles', { data: [{ id: 'gone', display_name: 'Kabir Rao' }] });
    const members = [member('me', 'Aarav')];
    const expenses = [expense('gone', ['me', 'gone'])];
    const settlements = [settlement('gone', 'me')];
    const { result } = await renderHook(() => useMoneyNames(members, expenses, settlements));

    await waitFor(() => expect(result.current.get('gone')).toBe('Kabir'));
    const [call] = queriesFor('profiles');
    expect(call.ops).toContainEqual(['in', ['id', ['gone']]]);
    expect(result.current.get('me')).toBe('Aarav');
  });
});
