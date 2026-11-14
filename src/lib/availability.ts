import { useCallback, useRef, useState } from 'react';

import { addDays, type Day } from './dates';
import { supabase } from './supabase';

export type Availability = {
  /** Days I've marked free. */
  myDays: Set<Day>;
  /** How many members are free on each day. */
  counts: Map<Day, number>;
  /** Who is free on each day (user ids). Only my own days when the trip hides who marked what. */
  who: Map<Day, string[]>;
};

export type BestRange = { start: Day; end: Day; free: number };

const EMPTY: Availability = { myDays: new Set(), counts: new Map(), who: new Map() };

/**
 * Builds the calendar state. `dayCounts` (from the `day_counts` table) is the source of the counts when
 * given, because the rows only include other people's days when the trip shows who marked what.
 */
export function summarise(
  rows: { user_id: string; day: string }[],
  me: string | undefined,
  dayCounts?: { day: string; free: number }[],
): Availability {
  const myDays = new Set<Day>();
  const who = new Map<Day, string[]>();
  for (const r of rows) {
    if (r.user_id === me) myDays.add(r.day);
    const list = who.get(r.day);
    if (list) list.push(r.user_id);
    else who.set(r.day, [r.user_id]);
  }
  const counts = new Map<Day, number>();
  if (dayCounts) for (const c of dayCounts) counts.set(c.day, c.free);
  else for (const [day, list] of who) counts.set(day, list.length);
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

/** Marks (`on`) or clears one of my days in `prev`, keeping counts and names in step. */
function withMyDay(prev: Availability, day: Day, on: boolean, me: string): Availability {
  if (prev.myDays.has(day) === on) return prev;
  const myDays = new Set(prev.myDays);
  const who = new Map(prev.who);
  const counts = new Map(prev.counts);
  const list = (who.get(day) ?? []).filter((u) => u !== me);
  if (on) {
    myDays.add(day);
    list.push(me);
  } else myDays.delete(day);
  if (list.length) who.set(day, list);
  else who.delete(day);
  // Counts are kept apart from `who`: other people's names may be hidden while their counts aren't.
  const n = (counts.get(day) ?? 0) + (on ? 1 : -1);
  if (n > 0) counts.set(day, n);
  else counts.delete(day);
  return { myDays, who, counts };
}

export function useAvailability(tripId: string | undefined, me: string | undefined) {
  const [data, setData] = useState<Availability>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Days still being saved, with the state I asked for. A reload that lands mid-save would otherwise
  // flash the old state back for a moment (the realtime reload after one tap often races the next tap).
  const pending = useRef(new Map<Day, { on: boolean; token: number }>());
  // Bumped on every save and every reload, so a reload that started before the latest change is dropped.
  const changes = useRef(0);
  const reloads = useRef(0);
  // Saves for the same day run one after another, so a quick mark-then-clear can't reach the server reversed.
  const queue = useRef(new Map<Day, Promise<unknown>>());

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const reload = ++reloads.current;
    for (;;) {
      const changesAtStart = changes.current;
      const [rowsRes, countsRes] = await Promise.all([
        supabase.from('availability').select('user_id, day').eq('trip_id', tripId),
        supabase.from('day_counts').select('day, free').eq('trip_id', tripId),
      ]);
      // A newer reload is on its way; let it decide.
      if (reload !== reloads.current) return;
      if (rowsRes.error || countsRes.error) setError("Couldn't load everyone's days. Check your connection and try again.");
      // I changed a day while this was loading, so it may be from before that change. Load again.
      else if (changes.current !== changesAtStart) continue;
      else {
        setError(null);
        let next = summarise(rowsRes.data ?? [], me, countsRes.data ?? []);
        if (me) for (const [day, { on }] of pending.current) next = withMyDay(next, day, on, me);
        setData(next);
      }
      setLoading(false);
      return;
    }
  }, [tripId, me]);

  /** Marks or clears one of my days. Updates the screen straight away and rolls back if saving fails. */
  const setDay = useCallback(
    async (day: Day, free: boolean) => {
      if (!tripId || !me) return;
      const token = ++changes.current;
      pending.current.set(day, { on: free, token });
      setData((prev) => withMyDay(prev, day, free, me));
      setError(null);
      const save = async () =>
        free
          ? await supabase.from('availability').upsert({ trip_id: tripId, user_id: me, day }, { onConflict: 'trip_id,user_id,day', ignoreDuplicates: true })
          : await supabase.from('availability').delete().eq('trip_id', tripId).eq('user_id', me).eq('day', day);
      const run = (queue.current.get(day) ?? Promise.resolve()).then(save, save);
      queue.current.set(day, run);
      const res = await run;
      if (queue.current.get(day) === run) queue.current.delete(day);
      changes.current++;
      // A later tap on the same day owns it now; only the latest save settles it.
      if (pending.current.get(day)?.token !== token) return;
      pending.current.delete(day);
      if (res.error) {
        setData((prev) => withMyDay(prev, day, !free, me));
        setError("Couldn't save that day. Check your connection and try again.");
      }
    },
    [tripId, me],
  );

  return { ...data, loading, error, refresh, setDay };
}
