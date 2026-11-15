import { formatRange } from '@/lib/dates';
import { countdown, homeChip, pipNext, tripDates, votedCount } from '@/lib/trip-status';
import type { TripStats } from '@/lib/trip-stats';
import { destination, MEMBER, members, ORGANISER, trip } from '../../test-utils/fixtures';

const TODAY = '2027-03-01';

describe('tripDates', () => {
  it('prefers the locked dates, then the fixed ones', () => {
    expect(tripDates({ locked_start: '2027-03-12', locked_end: '2027-03-14', fixed_start: '2027-04-01', fixed_end: '2027-04-02' })).toEqual({
      start: '2027-03-12',
      end: '2027-03-14',
    });
    expect(tripDates({ locked_start: null, locked_end: null, fixed_start: '2027-04-01', fixed_end: '2027-04-02' })).toEqual({ start: '2027-04-01', end: '2027-04-02' });
  });

  it('is null without dates', () => {
    expect(tripDates({ locked_start: null, locked_end: null })).toBeNull();
    expect(tripDates({ locked_start: null, locked_end: null, fixed_start: null, fixed_end: null })).toBeNull();
  });
});

describe('countdown', () => {
  const dates = { start: '2027-03-12', end: '2027-03-14' };

  it('counts the days to go', () => {
    expect(countdown(dates, TODAY)).toEqual({ kind: 'upcoming', days: 11 });
    expect(countdown(dates, '2027-03-11')).toEqual({ kind: 'upcoming', days: 1 });
  });

  it('says which day of the trip it is', () => {
    expect(countdown(dates, '2027-03-12')).toEqual({ kind: 'during', day: 1, of: 3 });
    expect(countdown(dates, '2027-03-14')).toEqual({ kind: 'during', day: 3, of: 3 });
  });

  it('is past after the last day, and null without dates', () => {
    expect(countdown(dates, '2027-03-15')).toEqual({ kind: 'past' });
    expect(countdown(null, TODAY)).toBeNull();
  });
});

describe('homeChip', () => {
  const planning = { status: 'planning' as const, locked_start: null, locked_end: null, fixed_start: null, fixed_end: null };
  const summary = (o: Partial<{ i_marked: boolean; i_voted: boolean; places: number }> = {}) => ({ i_marked: true, i_voted: true, places: 2, ...o });

  it('asks for my vote when I have not marked days or voted', () => {
    expect(homeChip(planning, summary({ i_marked: false }), 0, TODAY)).toEqual({ text: 'Your vote needed', tone: 'action' });
    expect(homeChip(planning, summary({ i_voted: false }), 0, TODAY)).toEqual({ text: 'Your vote needed', tone: 'action' });
  });

  it("doesn't ask for a vote on places that don't exist", () => {
    expect(homeChip(planning, summary({ i_voted: false, places: 0 }), 0, TODAY)).toEqual({ text: 'Voting open', tone: 'open' });
  });

  it('says voting is open once my part is done, or when the summary is missing', () => {
    expect(homeChip(planning, summary(), 0, TODAY)).toEqual({ text: 'Voting open', tone: 'open' });
    expect(homeChip(planning, undefined, 0, TODAY)).toEqual({ text: 'Voting open', tone: 'open' });
  });

  it("doesn't ask to mark days when the dates are fixed", () => {
    const fixed = { ...planning, fixed_start: '2027-03-12', fixed_end: '2027-03-14' };
    expect(homeChip(fixed, summary({ i_marked: false }), 0, TODAY)).toEqual({ text: 'Planning days', tone: 'open' });
    expect(homeChip(fixed, summary({ i_marked: false, i_voted: false }), 0, TODAY)).toEqual({ text: 'Your vote needed', tone: 'action' });
  });

  it('is planning days for a locked trip before and during it', () => {
    const locked = { ...planning, status: 'locked' as const, locked_start: '2027-03-12', locked_end: '2027-03-14' };
    expect(homeChip(locked, summary({ i_voted: false }), 0, TODAY)).toEqual({ text: 'Planning days', tone: 'open' });
    expect(homeChip(locked, null, 0, '2027-03-14')).toEqual({ text: 'Planning days', tone: 'open' });
  });

  it('is done after the trip, with the photo count', () => {
    const locked = { ...planning, status: 'locked' as const, locked_start: '2027-01-12', locked_end: '2027-01-14' };
    expect(homeChip(locked, null, 0, TODAY)).toEqual({ text: 'Done', tone: 'done' });
    expect(homeChip(locked, null, 1, TODAY)).toEqual({ text: 'Done · 1 photo', tone: 'done' });
    expect(homeChip(locked, null, 48, TODAY)).toEqual({ text: 'Done · 48 photos', tone: 'done' });
  });
});

describe('votedCount', () => {
  it('counts different voters across all places', () => {
    expect(votedCount([{ voters: ['a', 'b'] }, { voters: ['b', 'c'] }, { voters: [] }])).toBe(3);
    expect(votedCount([])).toBe(0);
  });
});

describe('pipNext', () => {
  const leader = destination({ id: 'd1', title: 'Palolem', voteCount: 1, voters: [MEMBER] });
  const best = [{ start: '2027-03-14', end: '2027-03-16', free: 2 }];

  it('asks the organiser to lock once there is a place and some dates', () => {
    const t = trip({ destinations: [leader], bestDays: best });
    expect(pipNext(t, ORGANISER, TODAY)).toEqual({
      text: `Looks like Palolem on ${formatRange('2027-03-14', '2027-03-16')}. Ready to lock it in?`,
      action: 'lock',
      label: 'Lock',
    });
    // Fixed dates stand in for the best days.
    const fixed = trip({ destinations: [leader], fixed_start: '2027-04-02', fixed_end: '2027-04-04' });
    expect(pipNext(fixed, ORGANISER, TODAY).text).toBe(`Looks like Palolem on ${formatRange('2027-04-02', '2027-04-04')}. Ready to lock it in?`);
  });

  it("asks me to mark my days when I haven't, unless the dates are fixed", () => {
    const t = trip({ destinations: [leader], bestDays: best });
    expect(pipNext(t, MEMBER, TODAY)).toEqual({ text: "You haven't marked when you're free yet.", action: 'days', label: 'Mark days' });
    const fixed = trip({ fixed_start: '2027-04-02', fixed_end: '2027-04-04' });
    expect(pipNext(fixed, MEMBER, TODAY).action).toBe('suggest');
  });

  it('asks for a place when there are none', () => {
    expect(pipNext(trip({ iMarked: true }), MEMBER, TODAY)).toEqual({ text: 'No places yet. Got somewhere in mind?', action: 'suggest', label: 'Suggest' });
  });

  it("asks for my vote when I haven't voted", () => {
    expect(pipNext(trip({ iMarked: true, destinations: [leader] }), ORGANISER, TODAY)).toEqual({
      text: 'Palolem is leading. Got a favourite?',
      action: 'vote',
      label: 'Vote',
    });
    const noVotes = destination({ title: 'Palolem' });
    expect(pipNext(trip({ iMarked: true, destinations: [noVotes] }), MEMBER, TODAY).text).toBe('Nobody has voted yet. Got a favourite?');
  });

  it("invites people when it's just me", () => {
    const voted = destination({ voteCount: 1, voters: [ORGANISER], iVoted: true });
    expect(pipNext(trip({ iMarked: true, destinations: [voted], members: [members[0]] }), ORGANISER, TODAY)).toEqual({
      text: "It's just you so far. Get the gang in.",
      action: 'invite',
      label: 'Invite',
    });
  });

  it('waits on the others to vote', () => {
    const voted = destination({ voteCount: 1, voters: [MEMBER], iVoted: true });
    const three = [...members, { ...members[1], user_id: 'third', display_name: 'Kabir' }];
    expect(pipNext(trip({ iMarked: true, destinations: [voted], members: three }), MEMBER, TODAY)).toEqual({
      text: 'Waiting on 2 more to vote.',
      action: 'nudge',
      label: 'Nudge',
    });
  });

  it('says everyone has voted when they have', () => {
    const voted = destination({ voteCount: 2, voters: [MEMBER, ORGANISER], iVoted: true });
    expect(pipNext(trip({ iMarked: true, destinations: [voted] }), MEMBER, TODAY)).toEqual({
      text: "Everyone's voted. Waiting on the organiser to lock it in.",
      action: 'vote',
      label: 'See votes',
    });
  });

  it('uses the plan, split and photos nudges on a fixed-date trip once the vote is done', () => {
    const voted = destination({ voteCount: 1, voters: [MEMBER], iVoted: true });
    const t = trip({ destinations: [voted], fixed_start: '2027-03-12', fixed_end: '2027-03-13' });
    const stats: TripStats = { trip_id: t.id, planned_days: ['2027-03-12'], photo_count: 0, photo_people: 0, my_photos: 0, spent_minor: 0, my_net_minor: 0 };
    expect(pipNext(t, MEMBER, TODAY, { stats })).toEqual({ text: 'Day 2 is still empty. Want to add something?', action: 'plan', label: 'Plan' });
  });

  describe('a locked trip', () => {
    const locked = trip({ status: 'locked', locked_start: '2027-03-12', locked_end: '2027-03-13', destinations: [leader] });
    const stats: TripStats = {
      trip_id: locked.id,
      planned_days: ['2027-03-12', '2027-03-13'],
      photo_count: 0,
      photo_people: 0,
      my_photos: 0,
      spent_minor: 0,
      my_net_minor: 0,
    };

    it('uses the nudge from the Plan, Split and Photos cards', () => {
      expect(pipNext(locked, ORGANISER, TODAY, { stats: { ...stats, planned_days: [] } })).toEqual({
        text: 'Day 1 and 2 are still empty. Want to add something?',
        action: 'plan',
        label: 'Plan',
      });
      expect(pipNext(locked, ORGANISER, TODAY, { stats, transfers: [{ from: ORGANISER, to: MEMBER, amount_minor: 60000 }] })).toEqual({
        text: 'You owe Meera ₹600. Settle up?',
        action: 'split',
        label: 'Split',
      });
      expect(pipNext(locked, ORGANISER, '2027-03-20', { stats })).toEqual({
        text: 'Add your photos so everyone gets the full album.',
        action: 'photos',
        label: 'Photos',
      });
    });

    it('falls back to sharing the news', () => {
      expect(pipNext(locked, ORGANISER, TODAY, { stats })).toEqual({ text: "It's official. Tell the group chat.", action: 'share', label: 'Share' });
      expect(pipNext(locked, ORGANISER, TODAY)).toEqual({ text: "It's official. Tell the group chat.", action: 'share', label: 'Share' });
    });
  });
});
