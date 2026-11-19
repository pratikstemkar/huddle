import { queueResult, rpcCalls } from '../../test-utils/supabase-mock';
import {
  answerHangout,
  bestSlotId,
  cancelHangout,
  closesLabel,
  createHangout,
  gridDays,
  hangoutName,
  hangoutStatusLine,
  lockHangout,
  parseMapsLink,
  picksToSlots,
  score,
  slotAt,
  slotForPart,
  slotLabel,
  slotShort,
  tally,
  timeRange,
  waitingOnMe,
  weekLabel,
  type HangoutListItem,
  type Slot,
} from '@/lib/hangouts';

const slot = (id: string, starts_at: string, answers: Slot['answers']): Slot => ({ id, starts_at, ends_at: null, answers });
const ans = (user_id: string, answer: 'yes' | 'maybe' | 'no') => ({ user_id, answer });

describe('names and times', () => {
  it('names a hangout from what was typed, else its activity', () => {
    expect(hangoutName('  Ramen run ', 'dinner')).toBe('Ramen run');
    expect(hangoutName('  ', 'coffee')).toBe('Coffee catch-up');
  });

  it('formats a time range, sharing the meridiem when both ends match', () => {
    const d = (h: number, m = 0) => new Date(2027, 0, 8, h, m).toISOString();
    expect(timeRange(d(19), d(21))).toBe('7 – 9 PM');
    expect(timeRange(d(10), d(12))).toBe('10 AM – 12 PM');
    expect(timeRange(d(19, 30), null)).toBe('7:30 PM');
    expect(slotLabel(d(19), d(21))).toBe('Fri 8 · 7 – 9 PM');
    expect(slotShort(d(19))).toBe('Fri 7 PM');
  });

  it('builds slots for a part of the day, local time, optionally with a set length', () => {
    const day = new Date(2027, 0, 8);
    const evening = slotForPart(day, 'evening', null);
    expect(new Date(evening.starts_at).getHours()).toBe(17);
    expect(new Date(evening.ends_at!).getHours()).toBe(21);
    const short = slotForPart(day, 'evening', 60);
    expect(new Date(short.ends_at!).getHours()).toBe(18);
    expect(new Date(slotForPart(day, 'late', null).ends_at!).getDate()).toBe(9);
    expect(slotAt(day, 19, 30, null)).toEqual({ starts_at: new Date(2027, 0, 8, 19, 30).toISOString(), ends_at: null });
  });

  it('orders picks, drops duplicates and applies the length', () => {
    const fri = new Date(2027, 0, 8);
    const sat = new Date(2027, 0, 9);
    const slots = picksToSlots(
      [
        { day: sat, part: 'evening' },
        { day: fri, hour: 19, minute: 0 },
        { day: sat, part: 'evening' },
      ],
      120,
    );
    expect(slots.map((s) => new Date(s.starts_at).getDate())).toEqual([8, 9]);
    expect(new Date(slots[0].ends_at!).getHours()).toBe(21);
  });

  it('lays out five days a week and labels them', () => {
    const days = gridDays(new Date(2027, 0, 30), 0);
    expect(days.map((d) => d.getDate())).toEqual([30, 31, 1, 2, 3]);
    expect(weekLabel(days)).toBe('Jan 30 – Feb 3');
    expect(weekLabel(gridDays(new Date(2027, 0, 4), 0))).toBe('Jan 4 – 8');
    expect(gridDays(new Date(2027, 0, 4), 1)[0].getDate()).toBe(9);
  });

  it('says when answers close', () => {
    const now = new Date(2027, 0, 8, 12);
    expect(closesLabel(new Date(2027, 0, 8, 18).toISOString(), now)).toBe('today, 6 PM');
    expect(closesLabel(new Date(2027, 0, 9, 18).toISOString(), now)).toBe('tomorrow, 6 PM');
    expect(closesLabel(new Date(2027, 0, 12, 18).toISOString(), now)).toBe('Tue 6 PM');
    expect(closesLabel(new Date(2027, 0, 8, 9).toISOString(), now)).toBe('closed');
  });
});

describe('answers', () => {
  const a = slot('a', '2027-01-08T19:00:00Z', [ans('u1', 'yes'), ans('u2', 'yes'), ans('u3', 'maybe')]);
  const b = slot('b', '2027-01-09T19:00:00Z', [ans('u1', 'yes'), ans('u2', 'yes'), ans('u3', 'maybe')]);
  const c = slot('c', '2027-01-10T19:00:00Z', [ans('u1', 'no')]);

  it('tallies and scores a yes double an if-needed', () => {
    expect(tally(a)).toEqual({ yes: 2, maybe: 1, no: 0 });
    expect(score(a)).toBe(5);
    expect(score(c)).toBe(0);
  });

  it('picks the best slot, earliest on a tie, and none while nobody can', () => {
    expect(bestSlotId([b, c, a])).toBe('a');
    expect(bestSlotId([c])).toBeNull();
    expect(bestSlotId([])).toBeNull();
  });
});

describe('Google Maps links', () => {
  it('reads the place name from a full link', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/Nori+House,+Indiranagar/@12.9,77.6,17z')).toEqual({
      url: 'https://www.google.com/maps/place/Nori+House,+Indiranagar/@12.9,77.6,17z',
      name: 'Nori House, Indiranagar',
    });
  });

  it('accepts short links with a generic name', () => {
    expect(parseMapsLink('https://maps.app.goo.gl/abc123')?.name).toBe('Place on Google Maps');
  });

  it('refuses anything that is not an http(s) Google Maps link', () => {
    expect(parseMapsLink('javascript:alert(1)')).toBeNull();
    expect(parseMapsLink('https://example.com/maps/place/x')).toBeNull();
    expect(parseMapsLink('https://www.google.com/search?q=x')).toBeNull();
    expect(parseMapsLink('not a link')).toBeNull();
  });
});

describe('lists', () => {
  const item = (over: Partial<HangoutListItem>): HangoutListItem => ({
    id: 'h1',
    name: 'Dinner',
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
    ...over,
  });

  it('waits on me only for open hangouts someone else made that I have not answered', () => {
    const list = [item({ id: 'a' }), item({ id: 'b', answered: true }), item({ id: 'c', organiser: true }), item({ id: 'd', status: 'locked' })];
    expect(waitingOnMe(list).map((h) => h.id)).toEqual(['a']);
  });

  it('says what is next on each hangout', () => {
    expect(hangoutStatusLine(item({}))).toBe('Needs your answer');
    expect(hangoutStatusLine(item({ answered: true }))).toBe('You answered');
    expect(hangoutStatusLine(item({ organiser: true }))).toBe('Waiting on answers');
    expect(hangoutStatusLine(item({ mode: 'set', organiser: true }))).toBe('You set the time');
    expect(hangoutStatusLine(item({ status: 'locked', starts_at: new Date(2027, 0, 8, 19).toISOString() }))).toBe('Locked · Fri 7 PM');
  });
});

describe('calls', () => {
  it('creates a hangout through create_hangout', async () => {
    queueResult('rpc:create_hangout', { data: 'h1' });
    const closes = new Date('2027-01-09T12:00:00Z');
    const slots = [{ starts_at: '2027-01-08T19:00:00Z', ends_at: '2027-01-08T21:00:00Z' }];
    const id = await createHangout({
      groupId: 'g1',
      kind: 'dinner',
      name: '',
      placeUrl: null,
      placeName: null,
      mode: 'find',
      durationMin: 120,
      closesAt: closes,
      slots,
      userIds: ['u2'],
    });
    expect(id).toBe('h1');
    expect(rpcCalls).toEqual([
      {
        name: 'create_hangout',
        args: { g: 'g1', k: 'dinner', n: 'Dinner with the gang', p_url: null, p_name: null, m: 'find', dur: 120, closes: closes.toISOString(), slots, user_ids: ['u2'] },
      },
    ]);
  });

  it('answers, locks and cancels', async () => {
    await answerHangout('s1', 'maybe');
    await answerHangout('s1', null);
    await lockHangout('h1', 's1');
    await cancelHangout('h1');
    expect(rpcCalls.map((c) => [c.name, c.args])).toEqual([
      ['answer_hangout', { s: 's1', a: 'maybe' }],
      ['answer_hangout', { s: 's1', a: null }],
      ['lock_hangout', { h: 'h1', s: 's1' }],
      ['cancel_hangout', { h: 'h1' }],
    ]);
  });

  it('turns failures into plain messages', async () => {
    queueResult('rpc:answer_hangout', { error: { message: 'That hangout is already settled' } });
    await expect(answerHangout('s1', 'yes')).rejects.toThrow('That hangout is already settled');
    queueResult('rpc:lock_hangout', { error: { message: 'boom: connection reset' } });
    await expect(lockHangout('h1', 's1')).rejects.toThrow("Couldn't lock the time. Check your connection and try again.");
  });
});
