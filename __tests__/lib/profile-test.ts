import { act, renderHook } from '@testing-library/react-native';

import { updateProfile, useMyProfile } from '@/lib/profile';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

describe('useMyProfile', () => {
  it('loads my profile row', async () => {
    const row = { id: 'me', display_name: 'Aarav', avatar_url: null, avatar_color: 'plum' };
    queueResult('profiles', { data: row });
    const { result } = await renderHook(() => useMyProfile('me'));
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ loading: false, error: null, profile: row });
    expect(queriesFor('profiles')[0].ops).toEqual([
      ['select', ['id, display_name, avatar_url, avatar_color']],
      ['eq', ['id', 'me']],
      ['maybeSingle', []],
    ]);
  });

  it('reports an error and keeps the last profile', async () => {
    queueResult('profiles', { data: { id: 'me', display_name: 'A' } }, { error: { message: 'offline' } });
    const { result } = await renderHook(() => useMyProfile('me'));
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Couldn't load your profile. Check your connection and try again.");
    expect(result.current.profile).toMatchObject({ display_name: 'A' });
  });

  it('skips the query when signed out', async () => {
    const { result } = await renderHook(() => useMyProfile(undefined));
    await act(() => result.current.refresh());
    expect(result.current.loading).toBe(false);
    expect(queriesFor('profiles')).toEqual([]);
  });
});

describe('updateProfile', () => {
  it('updates my row', async () => {
    queueResult('profiles', { data: [{ id: 'me' }] });
    await updateProfile('me', { display_name: 'Ravi', avatar_color: 'sky' });
    expect(queriesFor('profiles')[0].ops).toEqual([
      ['update', [{ display_name: 'Ravi', avatar_color: 'sky' }]],
      ['eq', ['id', 'me']],
      ['select', ['id']],
    ]);
  });

  it('throws when RLS updated nothing', async () => {
    queueResult('profiles', { data: [] });
    await expect(updateProfile('me', { display_name: 'R' })).rejects.toThrow('Not updated');
  });

  it('throws the database error', async () => {
    queueResult('profiles', { error: { message: 'too long' } });
    await expect(updateProfile('me', { display_name: 'R' })).rejects.toEqual({ message: 'too long' });
  });
});
