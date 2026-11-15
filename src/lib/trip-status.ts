import { formatRange, nightsBetween, tripDateRange, type Day, type TripDateFields } from './dates';
import type { Transfer } from './split';
import { tripNudge, type TripStats } from './trip-stats';
import type { Trip, TripDetail, TripSummary } from './trips';

/** The trip's dates: the locked dates, else the fixed ones, else null. */
export const tripDates: (trip: TripDateFields) => { start: Day; end: Day } | null = tripDateRange;

export type Countdown = { kind: 'upcoming'; days: number } | { kind: 'during'; day: number; of: number } | { kind: 'past' } | null;

/** Where today sits relative to the trip: days to go, which day of the trip it is, or over. */
export function countdown(dates: { start: Day; end: Day } | null, today: Day): Countdown {
  if (!dates) return null;
  if (today < dates.start) return { kind: 'upcoming', days: nightsBetween(today, dates.start) };
  if (today > dates.end) return { kind: 'past' };
  return { kind: 'during', day: nightsBetween(dates.start, today) + 1, of: nightsBetween(dates.start, dates.end) + 1 };
}

export type ChipTone = 'action' | 'open' | 'done';
export type HomeChip = { text: string; tone: ChipTone };

/**
 * The chip on a home trip card:
 * - "Done" (" · 48 photos" when there are photos): the trip's dates are over.
 * - "Your vote needed": planning, and I haven't marked days (when the dates aren't fixed) or haven't
 *   voted while places exist.
 * - "Planning days": the trip has dates (locked, or fixed up front) and isn't over.
 * - "Voting open": planning, and my part is done.
 * Tones: action = Beak / Ink, open = Vote tint / Iris text, done = Snow / secondary text.
 */
export function homeChip(
  trip: Pick<Trip, 'status' | 'locked_start' | 'locked_end' | 'fixed_start' | 'fixed_end'>,
  summary: Pick<TripSummary, 'i_marked' | 'i_voted' | 'places'> | null | undefined,
  photoCount: number,
  today: Day,
): HomeChip | null {
  const dates = tripDateRange(trip);
  if (dates && dates.end < today) {
    const photos = photoCount > 0 ? ` · ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : '';
    return { text: `Done${photos}`, tone: 'done' };
  }
  if (trip.status === 'planning' && summary) {
    const fixed = !!(trip.fixed_start && trip.fixed_end);
    if ((!fixed && !summary.i_marked) || (summary.places > 0 && !summary.i_voted)) return { text: 'Your vote needed', tone: 'action' };
  }
  if (dates) return { text: 'Planning days', tone: 'open' };
  return { text: 'Voting open', tone: 'open' };
}

/** How many different people have voted, across all the places. */
export function votedCount(destinations: { voters: string[] }[]): number {
  return new Set(destinations.flatMap((d) => d.voters)).size;
}

export type PipAction = 'lock' | 'days' | 'suggest' | 'vote' | 'invite' | 'share' | 'nudge' | 'plan' | 'split' | 'photos';
export type PipNext = { text: string; action: PipAction; label: string };

const NUDGE_LABELS = { plan: 'Plan', split: 'Split', photos: 'Photos' } as const;

/**
 * The Trip screen's "Pip says" card, first match wins.
 *
 * Locked trips: the Plan / Split / Photos nudge from `tripNudge`, else "It's official. Tell the group chat."
 * Planning trips (with fixed dates or not):
 * 1. Organiser, a place and some dates: "Looks like {leader} on {range}. Ready to lock it in?" [Lock]
 * 2. I haven't marked days, and the dates aren't fixed: "You haven't marked when you're free yet." [Mark days]
 * 3. No places: "No places yet. Got somewhere in mind?" [Suggest]
 * 4. I haven't voted: "{Leader} is leading. Got a favourite?" [Vote]
 * 5. Only one member: "It's just you so far. Get the gang in." [Invite]
 * 6. Fixed dates: the `tripNudge` line, if any.
 * 7. Otherwise: "Waiting on {k} more to vote." [Nudge], or when everyone has voted
 *    "Everyone's voted. Waiting on the organiser to lock it in." [See votes]
 */
export function pipNext(
  trip: TripDetail,
  me: string | undefined,
  today: Day,
  extra: { stats?: TripStats | null; transfers?: Transfer[] } = {},
): PipNext {
  const nudge = () => {
    const n = tripNudge(trip, extra.stats ?? null, me, extra.transfers, today);
    return n ? { text: n.text, action: n.action, label: NUDGE_LABELS[n.action] } : null;
  };

  if (trip.status === 'locked') return nudge() ?? { text: "It's official. Tell the group chat.", action: 'share', label: 'Share' };

  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const leader = trip.destinations[0];
  const fixed = !!(trip.fixed_start && trip.fixed_end);
  const range = fixed ? { start: trip.fixed_start!, end: trip.fixed_end! } : trip.bestDays[0];

  if (isOrganiser && leader && range) {
    return { text: `Looks like ${leader.title} on ${formatRange(range.start, range.end)}. Ready to lock it in?`, action: 'lock', label: 'Lock' };
  }
  if (!fixed && !trip.iMarked) return { text: "You haven't marked when you're free yet.", action: 'days', label: 'Mark days' };
  if (!leader) return { text: 'No places yet. Got somewhere in mind?', action: 'suggest', label: 'Suggest' };
  if (!trip.destinations.some((d) => d.iVoted)) {
    const text = leader.voteCount > 0 ? `${leader.title} is leading. Got a favourite?` : 'Nobody has voted yet. Got a favourite?';
    return { text, action: 'vote', label: 'Vote' };
  }
  if (trip.members.length <= 1) return { text: "It's just you so far. Get the gang in.", action: 'invite', label: 'Invite' };
  const fixedNudge = fixed ? nudge() : null;
  if (fixedNudge) return fixedNudge;
  const waiting = trip.members.length - votedCount(trip.destinations);
  if (waiting > 0) return { text: `Waiting on ${waiting} more to vote.`, action: 'nudge', label: 'Nudge' };
  return { text: "Everyone's voted. Waiting on the organiser to lock it in.", action: 'vote', label: 'See votes' };
}
