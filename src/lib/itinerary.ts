import { useCallback, useState } from 'react';

import { addDays, formatDay, nightsBetween, type Day } from './dates';
import { supabase } from './supabase';

export type PlanItem = {
  id: string;
  trip_id: string;
  day: Day;
  /** `HH:MM:SS`, floating (no time zone). */
  start_time: string;
  title: string;
  note: string | null;
  /** Null once the author deletes their account. */
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanItemInput = {
  day: Day;
  /** As typed: "9", "930", "9:30", "18.15", "6pm". */
  time: string;
  title: string;
  note?: string;
};

export const MAX_PLAN_TITLE = 80;
export const MAX_PLAN_NOTE = 200;

/** Every day from `start` to `end`, inclusive. */
export function tripDays(start: Day, end: Day): Day[] {
  const n = nightsBetween(start, end);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Reads a typed time into `HH:MM` (24 hours): "9" -> "09:00", "930" -> "09:30", "9:30" -> "09:30",
 * "18.15" -> "18:15", "6pm" -> "18:00", "12:30 am" -> "00:30". Null for anything else.
 */
export function parseTime(input: string): string | null {
  const m = input
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.h]?(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] === undefined ? 0 : Number(m[2]);
  const meridiem = m[3]?.[0];
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "09:00:00" -> "9:00", "18:15:00" -> "18:15" (24 hours, as designed). */
export function formatTime(t: string): string {
  const [h = '0', m = '00'] = t.split(':');
  return `${Number(h)}:${m.padStart(2, '0')}`;
}

const compareItems = (a: PlanItem, b: PlanItem) =>
  a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

/** Items by day, days in order, and each day's items by time (then the order they were added). */
export function groupByDay(items: PlanItem[]): Map<Day, PlanItem[]> {
  const sorted = [...items].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : compareItems(a, b)));
  const out = new Map<Day, PlanItem[]>();
  for (const item of sorted) {
    const list = out.get(item.day);
    if (list) list.push(item);
    else out.set(item.day, [item]);
  }
  return out;
}

/** Why the plan is closed before the trip has dates: it's built one day at a time. */
export const PLAN_NEEDS_DATES = "The plan is built day by day, so it opens once the trip's dates are locked in.";

/** How many of the trip's days have something planned, and which are still empty. */
export function planProgress(days: Day[], plannedDays: Day[]): { planned: number; total: number; empty: Day[] } {
  const planned = new Set(plannedDays);
  const empty = days.filter((d) => !planned.has(d));
  return { planned: days.length - empty.length, total: days.length, empty };
}

/** Items that aren't on the trip's days, e.g. after it was re-locked to new dates. */
export function itemsOffDates(items: PlanItem[], days: Day[]): PlanItem[] {
  const on = new Set(days);
  return items.filter((i) => !on.has(i.day));
}

export type DayStyle = 'weekday' | 'dayN';

/** Weekday names stop being unique past a week, so longer trips name days by number. */
export function dayStyleFor(days: Day[]): DayStyle {
  return days.length > 7 ? 'dayN' : 'weekday';
}

export function weekday(day: Day): string {
  return formatDay(day, { weekday: 'long' });
}

/**
 * Names a few days for a sentence: "Saturday", "Saturday and Sunday", "Friday, Saturday and 1 more";
 * by number: "Day 4", "Day 4 and 5", "Day 1, 2 and 3 more". Returns the name and whether it is plural.
 */
export function nameDays(list: Day[], days: Day[], style: DayStyle): { text: string; plural: boolean } {
  const label = (d: Day) => (style === 'weekday' ? weekday(d) : String(days.indexOf(d) + 1));
  const names = list.map(label);
  const prefix = style === 'dayN' ? 'Day ' : '';
  let text: string;
  if (names.length === 1) text = names[0];
  else if (names.length === 2) text = `${names[0]} and ${names[1]}`;
  else text = `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  return { text: prefix + text, plural: names.length > 1 };
}

/**
 * Pip's line about empty days:
 * "Every day has something planned." / "Saturday is wide open." / "Saturday and Sunday are wide open." /
 * "Friday, Saturday and 1 more are wide open." ('dayN': "Day 4 and 5 are wide open.")
 */
export function emptyDaysLine(empty: Day[], days: Day[], style: DayStyle): string {
  if (!empty.length) return 'Every day has something planned.';
  const { text, plural } = nameDays(empty, days, style);
  return `${text} ${plural ? 'are' : 'is'} wide open.`;
}

/** The message for a failed save: RLS refuses items off the trip's dates. */
export function planErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === '42501' || /row-level security/i.test(err?.message ?? '')) return "Plans can only go on the trip's dates.";
  if (err?.message === 'BAD_TIME') return 'Enter a time like 9:30 or 18:00.';
  return "Couldn't save the plan. Check your connection and try again.";
}

const PLAN_COLUMNS = 'id, trip_id, day, start_time, title, note, created_by, created_at, updated_at';

export function usePlan(tripId?: string) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('itinerary_items')
      .select(PLAN_COLUMNS)
      .eq('trip_id', tripId)
      .order('day')
      .order('start_time')
      .order('created_at');
    setError(error ? "Couldn't load the plan. Check your connection and try again." : null);
    if (!error) setItems((data ?? []) as PlanItem[]);
    setLoading(false);
  }, [tripId]);

  return { items, loading, error, refresh };
}

function toRow(i: PlanItemInput) {
  const time = parseTime(i.time);
  if (!time) throw new Error('BAD_TIME');
  return { day: i.day, start_time: time, title: i.title.trim(), note: i.note?.trim() || null };
}

/** Adds an item to the plan and returns its id. Throws `BAD_TIME` for a time that can't be read. */
export async function addPlanItem(tripId: string, i: PlanItemInput): Promise<string> {
  const row = toRow(i);
  const { data, error } = await supabase
    .from('itinerary_items')
    .insert({ trip_id: tripId, ...row })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Changes an item (the author or an organiser). Throws 'Not changed' when RLS let nothing through. */
export async function updatePlanItem(id: string, i: PlanItemInput): Promise<void> {
  const row = toRow(i);
  const { data, error } = await supabase.from('itinerary_items').update(row).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not changed');
}

export async function deletePlanItem(id: string): Promise<void> {
  const { data, error } = await supabase.from('itinerary_items').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not deleted');
}
