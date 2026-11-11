import { useCallback, useState } from 'react';

import { addDays, type Day } from './dates';
import { supabase } from './supabase';

export type Availability = {
  /** Days I've marked free. */
  myDays: Set<Day>;
  /** How many members are free on each day. */
  counts: Map<Day, number>;
  /** Who is free on each day (user ids). */
  who: Map<Day, string[]>;
};

export type BestRange = { start: Day; end: Day; free: number };

const EMPTY: Availability = { myDays: new Set(), counts: new Map(), who: new Map() };

export function summarise(rows: { user_id: string; day: string }[], me: string | undefined): Availability {
  const myDays = new Set<Day>();
  const who = new Map<Day, string[]>();
  for (const r of rows) {
    if (r.user_id === me) myDays.add(r.day);
    const list = who.get(r.day);
    if (list) list.push(r.user_id);
    else who.set(r.day, [r.user_id]);
  }
  const counts = new Map<Day, number>();
  for (const [day, list] of who) counts.set(day, list.length);
  return { myDays, counts, who };
}

/**
 * The days that suit the most people, with back-to-back days at the same level merged into ranges.
 * Needs at least 2 people free, and returns the top few, best first.
 */
export function bestRanges(counts: Map<Day, number>, from: Day, limit = 3): BestRange[] {
  const days = [...counts.entries()].filter(([d, n]) => n >= 2 && d >= from).sort(([a], [b]) => (a < b ? -1 : 1));
  if (days.length === 0) return [];
  const top = Math.max(...days.map(([, n]) => n));
  const ranges: BestRange[] = [];
  for (const [day, n] of days) {
    if (n !== top) continue;
    const last = ranges[ranges.length - 1];
    if (last && addDays(last.end, 1) === day) last.end = day;
    else ranges.push({ start: day, end: day, free: n });
  }
  return ranges.slice(0, limit);
}

export function useAvailability(tripId: string | undefined, me: string | undefined) {
  const [data, setData] = useState<Availability>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data: rows, error } = await supabase.from('availability').select('user_id, day').eq('trip_id', tripId);
    if (error) setError("Couldn't load everyone's days. Check your connection and try again.");
    else {
      setError(null);
      setData(summarise(rows ?? [], me));
    }
    setLoading(false);
  }, [tripId, me]);

  /** Marks or clears one of my days. Updates the screen straight away and rolls back if saving fails. */
  const setDay = useCallback(
    async (day: Day, free: boolean) => {
      if (!tripId || !me) return;
      const apply = (on: boolean) =>
        setData((prev) => {
          const myDays = new Set(prev.myDays);
          const who = new Map(prev.who);
          const counts = new Map(prev.counts);
          const list = (who.get(day) ?? []).filter((u) => u !== me);
          if (on) {
            myDays.add(day);
            list.push(me);
          } else myDays.delete(day);
          if (list.length) {
            who.set(day, list);
            counts.set(day, list.length);
          } else {
            who.delete(day);
            counts.delete(day);
          }
          return { myDays, who, counts };
        });

      apply(free);
      setError(null);
      const res = free
        ? await supabase.from('availability').upsert({ trip_id: tripId, user_id: me, day }, { onConflict: 'trip_id,user_id,day', ignoreDuplicates: true })
        : await supabase.from('availability').delete().eq('trip_id', tripId).eq('user_id', me).eq('day', day);
      if (res.error) {
        apply(!free);
        setError("Couldn't save that day. Check your connection and try again.");
      }
    },
    [tripId, me],
  );

  return { ...data, loading, error, refresh, setDay };
}
