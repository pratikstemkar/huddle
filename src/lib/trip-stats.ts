import { useCallback, useState } from 'react';

import { today as todayFn, tripDateRange, type Day, type TripDateFields } from './dates';
import { nameDays, planProgress, tripDays } from './itinerary';
import { formatMoney } from './money';
import type { Transfer } from './split';
import { supabase } from './supabase';

/** One row of `trip_stats`: the numbers behind the Plan, Split and Photos cards. */
export type TripStats = {
  trip_id: string;
  /** The trip's days that have at least one plan item. */
  planned_days: Day[];
  photo_count: number;
  /** How many people have added photos. */
  photo_people: number;
  /** How many photos I've added. */
  my_photos: number;
  spent_minor: number;
  /** Positive: I'm owed this much. Negative: I owe it. */
  my_net_minor: number;
};

/** "3 of 5 days planned"; before the trip has dates, "Opens once dates are locked". */
export function planCardText(trip: TripDateFields, s: Pick<TripStats, 'planned_days'> | null): string {
  const dates = tripDateRange(trip);
  if (!dates) return 'Opens once dates are locked';
  const { planned, total } = planProgress(tripDays(dates.start, dates.end), s?.planned_days ?? []);
  return `${planned} of ${total} ${total === 1 ? 'day' : 'days'} planned`;
}

export type CardTone = 'owed' | 'owe' | 'muted';

/** "You're owed ₹1,250" | "You owe ₹600" | "You're all square" | "Nothing spent yet". */
export function splitCardText(s: Pick<TripStats, 'spent_minor' | 'my_net_minor'> | null, currency = 'INR'): { text: string; tone: CardTone } {
  if (!s || !s.spent_minor) return { text: 'Nothing spent yet', tone: 'muted' };
  if (s.my_net_minor > 0) return { text: `You're owed ${formatMoney(s.my_net_minor, currency)}`, tone: 'owed' };
  if (s.my_net_minor < 0) return { text: `You owe ${formatMoney(-s.my_net_minor, currency)}`, tone: 'owe' };
  return { text: "You're all square", tone: 'muted' };
}

/** "24 so far" | "None yet". */
export function photosCardText(n: number): string {
  return n > 0 ? `${n} so far` : 'None yet';
}

export type NudgeAction = 'plan' | 'split' | 'photos';

type NudgeTrip = TripDateFields & { currency?: string; members?: { user_id: string; display_name: string }[] };

/**
 * Pip's nudge for a trip with dates, first match wins:
 * 1. Days still empty (before the trip ends): "Day 4 and 5 are still empty. Want to add something?" [Plan]
 * 2. I owe someone: "You owe Zoe ₹600. Settle up?" [Split] (needs the payments from useSplit)
 * 3. The trip is over and I haven't added photos: "Add your photos so everyone gets the full album." [Photos]
 * Null for a trip without dates, so the Vote rules apply, and when there's nothing to nudge about.
 */
export function tripNudge(
  trip: NudgeTrip,
  s: TripStats | null,
  me: string | undefined,
  transfers?: Transfer[],
  today: Day = todayFn(),
): { text: string; action: NudgeAction } | null {
  const dates = tripDateRange(trip);
  if (!dates) return null;
  const past = dates.end < today;

  if (s && !past) {
    const days = tripDays(dates.start, dates.end);
    const { empty } = planProgress(days, s.planned_days);
    if (empty.length) {
      const { text, plural } = nameDays(empty, days, 'dayN');
      return { text: `${text} ${plural ? 'are' : 'is'} still empty. Want to add something?`, action: 'plan' };
    }
  }

  const owing = me ? (transfers ?? []).filter((t) => t.from === me).sort((a, b) => b.amount_minor - a.amount_minor)[0] : undefined;
  if (owing) {
    const name = trip.members?.find((m) => m.user_id === owing.to)?.display_name ?? 'someone';
    return { text: `You owe ${name} ${formatMoney(owing.amount_minor, trip.currency)}. Settle up?`, action: 'split' };
  }

  if (s && past && s.my_photos === 0) return { text: 'Add your photos so everyone gets the full album.', action: 'photos' };
  return null;
}

const STATS_COLUMNS = 'trip_id, planned_days, photo_count, photo_people, my_photos, spent_minor, my_net_minor';

function toStats(row: TripStats): TripStats {
  return {
    ...row,
    planned_days: row.planned_days ?? [],
    photo_count: Number(row.photo_count),
    photo_people: Number(row.photo_people),
    my_photos: Number(row.my_photos),
    spent_minor: Number(row.spent_minor),
    my_net_minor: Number(row.my_net_minor),
  };
}

/** The Trip screen's card numbers. `stats` stays null until loaded, or if the trip isn't visible. */
export function useTripStats(tripId?: string) {
  const [stats, setStats] = useState<TripStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase.from('trip_stats').select(STATS_COLUMNS).eq('trip_id', tripId).maybeSingle();
    setError(error ? "Couldn't load the trip's numbers." : null);
    if (!error) setStats(data ? toStats(data as TripStats) : null);
  }, [tripId]);

  return { stats, error, refresh };
}
