import { useCallback, useState } from 'react';

import { toTripColor } from '@/theme/tokens';
import type { GroupPerson } from './groups';
import { supabase } from './supabase';

export type HangoutKind = 'dinner' | 'coffee' | 'movie' | 'drinks' | 'games' | 'out';
export type HangoutMode = 'find' | 'set';
export type HangoutStatus = 'open' | 'locked' | 'cancelled';
export type Answer = 'yes' | 'maybe' | 'no';

export const MAX_HANGOUT_NAME = 60;

/** The activities on the new-hangout screen, with the name Huddle fills in when you leave it blank. */
export const KINDS: { id: HangoutKind; label: string; icon: 'dinner' | 'coffee' | 'movie' | 'drinks' | 'games' | 'out'; name: string }[] = [
  { id: 'dinner', label: 'Dinner', icon: 'dinner', name: 'Dinner with the gang' },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', name: 'Coffee catch-up' },
  { id: 'movie', label: 'Movie', icon: 'movie', name: 'Movie night' },
  { id: 'drinks', label: 'Drinks', icon: 'drinks', name: 'Drinks after work' },
  { id: 'games', label: 'Games', icon: 'games', name: 'Game night' },
  { id: 'out', label: 'Day out', icon: 'out', name: 'Day out' },
];

export const kindName = (kind: HangoutKind) => KINDS.find((k) => k.id === kind)?.name ?? 'Hangout';

/** The name a hangout gets: what was typed, else the activity's default. */
export function hangoutName(typed: string, kind: HangoutKind) {
  return typed.trim() || kindName(kind);
}

// ---- Time slots ----------------------------------------------------------------------------------------------

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'late';

/** The rows of the suggest-times grid: local start and end hour (24 = midnight). */
export const PARTS: { id: PartOfDay; label: string; sub: string; from: number; to: number }[] = [
  { id: 'morning', label: 'Morning', sub: '9 – 12', from: 9, to: 12 },
  { id: 'afternoon', label: 'Afternoon', sub: '12 – 5', from: 12, to: 17 },
  { id: 'evening', label: 'Evening', sub: '5 – 9', from: 17, to: 21 },
  { id: 'late', label: 'Late', sub: '9 PM +', from: 21, to: 24 },
];

export type NewSlot = { starts_at: string; ends_at: string | null };

/** A slot on `day` (local) for a part of the day. When `durationMin` is set, the slot is that long from the start of the part. */
export function slotForPart(day: Date, part: PartOfDay, durationMin: number | null): NewSlot {
  const p = PARTS.find((x) => x.id === part)!;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.from);
  const end = durationMin ? new Date(start.getTime() + durationMin * 60000) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.to);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/** A slot at an exact local time. Open-length hangouts get no end. */
export function slotAt(day: Date, hour: number, minute: number, durationMin: number | null): NewSlot {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  return { starts_at: start.toISOString(), ends_at: durationMin ? new Date(start.getTime() + durationMin * 60000).toISOString() : null };
}

/** A time someone tapped on the suggest-times screen: a part of a day, or an exact time. */
export type SlotPick = { day: Date; part?: PartOfDay; hour?: number; minute?: number };

export const pickKey = (p: SlotPick) => {
  const d = `${p.day.getFullYear()}-${p.day.getMonth() + 1}-${p.day.getDate()}`;
  return p.part ? `${d}|${p.part}` : `${d}|${p.hour}:${p.minute ?? 0}`;
};

/** The picks as slots, earliest first. Duplicates (the same key) collapse to one. */
export function picksToSlots(picks: SlotPick[], durationMin: number | null): NewSlot[] {
  const seen = new Map<string, SlotPick>();
  for (const p of picks) seen.set(pickKey(p), p);
  return [...seen.values()]
    .map((p) => (p.part ? slotForPart(p.day, p.part, durationMin) : slotAt(p.day, p.hour ?? 0, p.minute ?? 0, durationMin)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Exact times offered when someone adds a time by hand. */
export const EXACT_TIMES: { hour: number; minute: number; label: string }[] = [
  [10, 0], [12, 0], [13, 0], [15, 0], [17, 0], [18, 0], [19, 0], [19, 30], [20, 0], [21, 0],
].map(([hour, minute]) => {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour, minute, label: `${h12}${minute ? ':' + String(minute).padStart(2, '0') : ''} ${hour < 12 ? 'AM' : 'PM'}` };
});

export const DURATIONS: { id: string; label: string; minutes: number | null }[] = [
  { id: '1h', label: '1 hr', minutes: 60 },
  { id: '2h', label: '2 hrs', minutes: 120 },
  { id: '3h', label: '3 hrs', minutes: 180 },
  { id: 'open', label: 'Open', minutes: null },
];

/** Five consecutive days for the suggest-times grid; `week` 0 starts today. */
export function gridDays(from: Date, week: number): Date[] {
  return Array.from({ length: 5 }, (_, i) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + week * 5 + i));
}

const weekdayFmt = new Intl.DateTimeFormat('en', { weekday: 'short' });
const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

export function weekLabel(days: Date[]) {
  const a = days[0];
  const b = days[days.length - 1];
  const end = a.getMonth() === b.getMonth() ? String(b.getDate()) : monthDay.format(b);
  return `${monthDay.format(a)} – ${end}`;
}

function clock(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: m ? `${h12}:${String(m).padStart(2, '0')}` : String(h12), meridiem: h < 12 ? 'AM' : 'PM' };
}

/** "7 – 9 PM", "10 AM – 12 PM", or "7 PM" when there is no end. */
export function timeRange(startIso: string, endIso: string | null) {
  const s = clock(new Date(startIso));
  if (!endIso) return `${s.text} ${s.meridiem}`;
  const e = clock(new Date(endIso));
  return s.meridiem === e.meridiem ? `${s.text} – ${e.text} ${e.meridiem}` : `${s.text} ${s.meridiem} – ${e.text} ${e.meridiem}`;
}

/** "Fri 20 · 7 – 9 PM". */
export function slotLabel(startIso: string, endIso: string | null) {
  const d = new Date(startIso);
  return `${weekdayFmt.format(d)} ${d.getDate()} · ${timeRange(startIso, endIso)}`;
}

/** "Fri 7 PM": the short form for the lock button. */
export function slotShort(startIso: string) {
  const c = clock(new Date(startIso));
  return `${weekdayFmt.format(new Date(startIso))} ${c.text} ${c.meridiem}`;
}

/** When answers close, in words: "today, 6 PM", "tomorrow, 6 PM", "Fri 6 PM", or "closed" once it has passed. */
export function closesLabel(iso: string, now: Date = new Date()) {
  const at = new Date(iso);
  if (at.getTime() <= now.getTime()) return 'closed';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(at) - startOf(now)) / 86400000);
  const t = timeRange(iso, null);
  if (days === 0) return `today, ${t}`;
  if (days === 1) return `tomorrow, ${t}`;
  return `${weekdayFmt.format(at)} ${t}`;
}

// ---- Answers -------------------------------------------------------------------------------------------------

export type SlotAnswer = { user_id: string; answer: Answer };
export type Slot = { id: string; starts_at: string; ends_at: string | null; answers: SlotAnswer[] };

export type Tally = { yes: number; maybe: number; no: number };

export function tally(slot: Pick<Slot, 'answers'>): Tally {
  const t: Tally = { yes: 0, maybe: 0, no: 0 };
  for (const a of slot.answers) t[a.answer]++;
  return t;
}

/** A slot's score: a yes counts double an "if needed"; "can't" counts nothing. */
export function score(slot: Pick<Slot, 'answers'>) {
  const t = tally(slot);
  return t.yes * 2 + t.maybe;
}

/** The slot most people can make (earliest wins a tie), or null while nobody has said they can. */
export function bestSlotId(slots: Slot[]): string | null {
  let best: Slot | null = null;
  for (const s of slots) {
    if (score(s) === 0) continue;
    if (!best || score(s) > score(best) || (score(s) === score(best) && s.starts_at < best.starts_at)) best = s;
  }
  return best?.id ?? null;
}

export function myAnswer(slot: Slot, me: string | undefined): Answer | null {
  return slot.answers.find((a) => a.user_id === me)?.answer ?? null;
}

/** People who have answered at least one slot. */
export function answeredIds(slots: Slot[]) {
  return new Set(slots.flatMap((s) => s.answers.map((a) => a.user_id)));
}

/** How many of the people asked (everyone but the organiser) have answered, and how many were asked. */
export function answerProgress(h: Pick<HangoutDetail, 'members' | 'slots' | 'created_by'>) {
  const answered = answeredIds(h.slots);
  const asked = h.members.filter((m) => m.user_id !== h.created_by);
  return { answered: asked.filter((m) => answered.has(m.user_id)).length, asked: asked.length };
}

// ---- Places ---------------------------------------------------------------------------------------------------

const MAPS_HOSTS = /^(www\.|maps\.)?google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/i;

/**
 * Reads a pasted Google Maps link. Returns null for anything that isn't an http(s) Maps link. The name comes from
 * `/place/<name>/` in a full link; a short `maps.app.goo.gl` link can't be opened from here, so it gets a generic name.
 */
export function parseMapsLink(raw: string): { url: string; name: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!MAPS_HOSTS.test(u.hostname)) return null;
  if (/^(www\.)?google\./i.test(u.hostname) && !u.pathname.startsWith('/maps')) return null;
  const m = u.pathname.match(/\/place\/([^/]+)/);
  let name = 'Place on Google Maps';
  if (m) {
    try {
      name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim() || name;
    } catch {
      /* keep the generic name */
    }
  }
  return { url: u.toString(), name: name.slice(0, 120) };
}

// ---- Calls ----------------------------------------------------------------------------------------------------

export type NewHangout = {
  groupId: string;
  kind: HangoutKind;
  name: string;
  placeUrl: string | null;
  placeName: string | null;
  mode: HangoutMode;
  durationMin: number | null;
  closesAt: Date | null;
  slots: NewSlot[];
  userIds: string[];
};

function friendly(error: { message: string } | null, fallback: string): Error {
  if (error && /no longer there|already settled|Only the organiser|between one and twenty|only plan a hangout/i.test(error.message)) {
    return new Error(error.message.replace(/^.*?: /, ''));
  }
  return new Error(fallback);
}

/** Creates a hangout and invites the chosen group members. Returns its id. */
export async function createHangout(h: NewHangout): Promise<string> {
  const { data, error } = await supabase.rpc('create_hangout', {
    g: h.groupId,
    k: h.kind,
    n: hangoutName(h.name, h.kind),
    p_url: h.placeUrl,
    p_name: h.placeName,
    m: h.mode,
    dur: h.durationMin,
    closes: h.closesAt ? h.closesAt.toISOString() : null,
    slots: h.slots,
    user_ids: h.userIds,
  });
  if (error) throw friendly(error, "Couldn't create the hangout. Check your connection and try again.");
  return data as string;
}

/** Sets my answer on a time (null clears it). */
export async function answerHangout(slotId: string, answer: Answer | null) {
  const { error } = await supabase.rpc('answer_hangout', { s: slotId, a: answer });
  if (error) throw friendly(error, "Couldn't save your answer. Check your connection and try again.");
}

export async function lockHangout(hangoutId: string, slotId: string) {
  const { error } = await supabase.rpc('lock_hangout', { h: hangoutId, s: slotId });
  if (error) throw friendly(error, "Couldn't lock the time. Check your connection and try again.");
}

export async function cancelHangout(hangoutId: string) {
  const { error } = await supabase.rpc('cancel_hangout', { h: hangoutId });
  if (error) throw friendly(error, "Couldn't cancel the hangout. Check your connection and try again.");
}

// ---- Reading --------------------------------------------------------------------------------------------------

export type HangoutDetail = {
  id: string;
  group_id: string | null;
  group_name: string | null;
  created_by: string | null;
  organiser: string;
  kind: HangoutKind;
  name: string;
  place_url: string | null;
  place_name: string | null;
  mode: HangoutMode;
  duration_min: number | null;
  answers_close_at: string | null;
  status: HangoutStatus;
  locked_slot_id: string | null;
  members: GroupPerson[];
  slots: Slot[];
};

type ProfileEmbed = { display_name: string; avatar_url: string | null; avatar_color: string | null } | null;
type HangoutRow = Omit<HangoutDetail, 'members' | 'slots' | 'group_name' | 'organiser'> & { groups: { name: string } | null };
type MemberRow = { user_id: string; profiles: ProfileEmbed };
type SlotRow = { id: string; starts_at: string; ends_at: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANGOUT_COLUMNS =
  'id, group_id, created_by, kind, name, place_url, place_name, mode, duration_min, answers_close_at, status, locked_slot_id, groups(name)';

function person(user_id: string, p: ProfileEmbed): GroupPerson {
  return {
    user_id,
    display_name: p?.display_name ?? 'Someone',
    avatar_url: p?.avatar_url ?? null,
    avatar_color: p?.avatar_color ? toTripColor(p.avatar_color) : null,
  };
}

/** One hangout with its people, times and answers. `hangout` is null when it's missing or I'm not in it. */
export function useHangout(id: string | undefined) {
  const [hangout, setHangout] = useState<HangoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id || !UUID.test(id)) {
      setHangout(null);
      setLoading(false);
      return;
    }
    const [hRes, mRes, sRes] = await Promise.all([
      supabase.from('hangouts').select(HANGOUT_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('hangout_members').select('user_id, profiles(display_name, avatar_url, avatar_color)').eq('hangout_id', id).order('created_at'),
      supabase.from('hangout_slots').select('id, starts_at, ends_at').eq('hangout_id', id).order('starts_at'),
    ]);
    const slotRows = (sRes.data ?? []) as SlotRow[];
    const aRes = slotRows.length
      ? await supabase.from('hangout_answers').select('slot_id, user_id, answer').in('slot_id', slotRows.map((s) => s.id))
      : { data: [], error: null };
    const failed = hRes.error ?? mRes.error ?? sRes.error ?? aRes.error;
    setError(failed ? "Couldn't load the hangout. Check your connection and try again." : null);
    if (!failed) {
      const row = hRes.data as unknown as HangoutRow | null;
      if (!row) {
        setHangout(null);
      } else {
        const members = ((mRes.data ?? []) as unknown as MemberRow[]).map((m) => person(m.user_id, m.profiles));
        const answers = (aRes.data ?? []) as { slot_id: string; user_id: string; answer: Answer }[];
        const { groups, ...rest } = row;
        setHangout({
          ...rest,
          group_name: groups?.name ?? null,
          organiser: members.find((m) => m.user_id === row.created_by)?.display_name ?? 'Someone',
          members,
          slots: slotRows.map((s) => ({
            ...s,
            answers: answers.filter((a) => a.slot_id === s.id).map((a) => ({ user_id: a.user_id, answer: a.answer })),
          })),
        });
      }
    }
    setLoading(false);
  }, [id]);

  return { hangout, loading, error, refresh };
}

/** A hangout on a list: what the Groups tab and a group's page show. */
export type HangoutListItem = {
  id: string;
  name: string;
  kind: HangoutKind;
  mode: HangoutMode;
  status: HangoutStatus;
  group_id: string | null;
  group_name: string | null;
  from: string;
  organiser: boolean;
  answered: boolean;
  starts_at: string | null;
  created_at: string;
};

type ListRow = {
  hangout_id: string;
  name: string;
  kind: HangoutKind;
  mode: HangoutMode;
  status: HangoutStatus;
  group_id: string | null;
  group_name: string | null;
  from_name: string;
  organiser: boolean;
  answered: boolean;
  starts_at: string | null;
  created_at: string;
};

/** Hangouts I'm part of, newest first. Callers trigger `refresh`. */
export function useMyHangouts() {
  const [hangouts, setHangouts] = useState<HangoutListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_hangouts');
    setError(error ? "Couldn't load your hangouts. Check your connection and try again." : null);
    if (!error) {
      setHangouts(
        ((data ?? []) as ListRow[]).map((r) => ({
          id: r.hangout_id,
          name: r.name,
          kind: r.kind,
          mode: r.mode,
          status: r.status,
          group_id: r.group_id,
          group_name: r.group_name,
          from: r.from_name,
          organiser: r.organiser,
          answered: r.answered,
          starts_at: r.starts_at,
          created_at: r.created_at,
        })),
      );
    }
  }, []);
  return { hangouts, error, refresh };
}

/** Open hangouts waiting on my answer: someone else's, and I haven't answered anything yet. */
export const waitingOnMe = (list: HangoutListItem[]) => list.filter((h) => h.status === 'open' && !h.organiser && !h.answered);

/** One line for a hangout on a list: its locked time, or what's needed next. */
export function hangoutStatusLine(h: HangoutListItem) {
  if (h.status === 'locked' && h.starts_at) return `Locked · ${slotShort(h.starts_at)}`;
  if (h.mode === 'set') return h.organiser ? 'You set the time' : h.answered ? 'You answered' : 'Needs your answer';
  if (h.organiser) return 'Waiting on answers';
  return h.answered ? 'You answered' : 'Needs your answer';
}
