import type { Countdown } from '@/lib/trip-status';

/** The big hero line: "12 days to go", "Tomorrow!", "Today's the day", "Day 2 of 4", "That's a wrap". */
export function countdownHeadline(cd: Countdown): string | null {
  if (!cd) return null;
  if (cd.kind === 'upcoming') return cd.days === 1 ? 'Tomorrow!' : `${cd.days} days to go`;
  if (cd.kind === 'during') return cd.day === 1 ? "Today's the day" : `Day ${cd.day} of ${cd.of}`;
  return "That's a wrap";
}

/** The short form after "{n} going · ": "12 days to go", "tomorrow", "today", "day 2 of 4", "done". */
export function countdownShort(cd: Countdown): string | null {
  if (!cd) return null;
  if (cd.kind === 'upcoming') return cd.days === 1 ? 'tomorrow' : `${cd.days} days to go`;
  if (cd.kind === 'during') return cd.day === 1 ? 'today' : `day ${cd.day} of ${cd.of}`;
  return 'done';
}

/** "5 friends", or "Just you" for a trip of one. */
export function friendsText(n: number): string {
  return n === 1 ? 'Just you' : `${n} friends`;
}

/** "Day trip", "1 night", "3 nights". */
export function nightsText(nights: number): string {
  return nights === 0 ? 'Day trip' : `${nights} ${nights === 1 ? 'night' : 'nights'}`;
}
