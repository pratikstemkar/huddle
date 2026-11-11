import { act, renderHook } from '@testing-library/react-native';

import { hostOf, normaliseUrl, rankDestinations, suggestDestination, useDestinations } from '@/lib/destinations';
import { queriesFor, queueResult } from '../../test-utils/supabase-mock';

const ME = 'me';
const row = (id: string, created_at: string) => ({
  id,
  title: `Place ${id}`,
  note: null,
  url: null,
  image_url: null,
  created_by: 'b',
  created_at,
});

describe('rankDestinations', () => {
  const rows = [row('a', '2027-01-01T10:00:00Z'), row('b', '2027-01-01T09:00:00Z'), row('c', '2027-01-01T11:00:00Z')];

  it('sorts by votes, then oldest first', () => {
    const votes = [
      { destination_id: 'c', user_id: ME },
      { destination_id: 'c', user_id: 'x' },
      { destination_id: 'a', user_id: 'x' },
    ];
    expect(rankDestinations(rows, votes, ME).map((d) => d.id)).toEqual(['c', 'a', 'b']);
  });

  it('breaks ties by creation time', () => {
    expect(rankDestinations(rows, [], ME).map((d) => d.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the input order for identical timestamps', () => {
    const same = [row('x', '2027-01-01T00:00:00Z'), row('y', '2027-01-01T00:00:00Z')];
    expect(rankDestinations(same, [], ME).map((d) => d.id)).toEqual(['x', 'y']);
  });

  it('adds vote counts, voters and whether I voted', () => {
    const [top, ...rest] = rankDestinations(rows, [{ destination_id: 'a', user_id: ME }, { destination_id: 'a', user_id: 'z' }], ME);
    expect(top).toMatchObject({ id: 'a', voteCount: 2, voters: [ME, 'z'], iVoted: true });
    for (const d of rest) expect(d).toMatchObject({ voteCount: 0, voters: [], iVoted: false });
  });

  it("never marks a vote as mine when I'm signed out", () => {
    const [d] = rankDestinations([rows[0]], [{ destination_id: 'a', user_id: ME }], undefined);
    expect(d.iVoted).toBe(false);
  });

  it('ignores votes for unknown destinations', () => {
    const ranked = rankDestinations([rows[0]], [{ destination_id: 'gone', user_id: ME }], ME);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].voteCount).toBe(0);
  });
});

describe('normaliseUrl', () => {
  it('keeps http and https links', () => {
    expect(normaliseUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(normaliseUrl('HTTP://Example.com')).toBe('HTTP://Example.com');
  });

  it('adds https:// when missing and trims spaces', () => {
    expect(normaliseUrl('  goa.example.com/beach ')).toBe('https://goa.example.com/beach');
  });

  it('returns null for empty input', () => {
    expect(normaliseUrl('')).toBeNull();
    expect(normaliseUrl('   ')).toBeNull();
  });

  it('returns null for hosts without a dot', () => {
    expect(normaliseUrl('localhost')).toBeNull();
    expect(normaliseUrl('https://intranet/page')).toBeNull();
  });

  it('returns null for things that are not URLs', () => {
    expect(normaliseUrl('not a url')).toBeNull();
    expect(normaliseUrl('https://')).toBeNull();
  });

  it('returns null for links over 2048 characters', () => {
    expect(normaliseUrl(`https://example.com/${'a'.repeat(2040)}`)).toBeNull();
    expect(normaliseUrl(`https://example.com/${'a'.repeat(2020)}`)).not.toBeNull();
  });
});

describe('hostOf', () => {
  it('returns the hostname without www', () => {
    expect(hostOf('https://www.example.com/path')).toBe('example.com');
    expect(hostOf('https://en.wikipedia.org/wiki/Goa')).toBe('en.wikipedia.org');
  });

  it('returns the input when it is not a URL', () => {
    expect(hostOf('nope')).toBe('nope');
  });
});

describe('suggestDestination', () => {
  it('inserts the suggestion, storing blanks as null', async () => {
    await suggestDestination('t1', { title: 'Palolem', note: '', url: 'https://x.com', imageUrl: undefined });
    expect(queriesFor('destinations')[0].ops).toEqual([
      ['insert', [{ trip_id: 't1', title: 'Palolem', note: null, url: 'https://x.com', image_url: null }]],
    ]);
  });

  it('throws the database error', async () => {
    queueResult('destinations', { error: { message: 'denied' } });
    await expect(suggestDestination('t1', { title: 'x' })).rejects.toEqual({ message: 'denied' });
  });
});

describe('useDestinations', () => {
  const rows = [row('a', '2027-01-01T10:00:00Z'), row('b', '2027-01-01T09:00:00Z')];

  async function loaded(votes: { destination_id: string; user_id: string }[] = []) {
    queueResult('destinations', { data: rows });
    queueResult('votes', { data: votes });
    const hook = await renderHook(() => useDestinations('t1', ME));
    await act(() => hook.result.current.refresh());
    return hook;
  }

  it('loads and ranks the places', async () => {
    const { result } = await loaded([{ destination_id: 'a', user_id: 'x' }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.list.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('shows an error when either query fails', async () => {
    queueResult('destinations', { data: rows });
    queueResult('votes', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useDestinations('t1', ME));
    await act(() => result.current.refresh());
    expect(result.current.error).toMatch(/Couldn't load the places/);
  });

  it('does nothing without a trip id', async () => {
    const { result } = await renderHook(() => useDestinations(undefined, ME));
    await act(() => result.current.refresh());
    expect(queriesFor('destinations')).toHaveLength(0);
  });

  it('votes straight away, re-ranks and saves', async () => {
    const { result } = await loaded();
    await act(() => result.current.toggleVote('a'));
    expect(result.current.list[0]).toMatchObject({ id: 'a', iVoted: true, voteCount: 1, voters: [ME] });
    expect(queriesFor('votes')[1].ops[0]).toEqual([
      'upsert',
      [{ destination_id: 'a', trip_id: 't1', user_id: ME }, { onConflict: 'destination_id,user_id', ignoreDuplicates: true }],
    ]);
  });

  it('removes my vote', async () => {
    const { result } = await loaded([{ destination_id: 'a', user_id: ME }]);
    await act(() => result.current.toggleVote('a'));
    expect(result.current.list.find((d) => d.id === 'a')).toMatchObject({ iVoted: false, voteCount: 0 });
    expect(queriesFor('votes')[1].ops).toEqual([
      ['delete', []],
      ['eq', ['destination_id', 'a']],
      ['eq', ['user_id', ME]],
    ]);
  });

  it('rolls the vote back when saving fails', async () => {
    const { result } = await loaded();
    queueResult('votes', { error: { message: 'offline' } });
    await act(() => result.current.toggleVote('a'));
    expect(result.current.list.find((d) => d.id === 'a')).toMatchObject({ iVoted: false, voteCount: 0 });
    expect(result.current.error).toMatch(/Couldn't save your vote/);
  });

  it('ignores votes for places not in the list', async () => {
    const { result } = await loaded();
    await act(() => result.current.toggleVote('missing'));
    expect(queriesFor('votes')).toHaveLength(1);
  });

  it('removes a place', async () => {
    const { result } = await loaded();
    await act(() => result.current.remove('a'));
    expect(result.current.list.map((d) => d.id)).toEqual(['b']);
    expect(queriesFor('destinations')[1].ops).toEqual([
      ['delete', []],
      ['eq', ['id', 'a']],
    ]);
  });

  it('keeps the place and shows an error when removing fails', async () => {
    const { result } = await loaded();
    queueResult('destinations', { error: { message: 'denied' } });
    await act(() => result.current.remove('a'));
    expect(result.current.list).toHaveLength(2);
    expect(result.current.error).toMatch(/Couldn't remove/);
  });
});
