import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import type { TripColor } from '@/theme/tokens';
import { bestRanges, type BestRange } from './availability';
import { today } from './dates';
import { DESTINATION_COLUMNS, rankDestinations, withPhotos, type Destination, type DestinationRow } from './destinations';
import { deleteLocalTrip, removeTripPhotos, signPhotos } from './place-photo';
import { supabase } from './supabase';

export type Trip = {
  id: string;
  name: string;
  color: TripColor;
  status: 'planning' | 'locked';
  invite_code: string;
  created_at: string;
  locked_start: string | null;
  locked_end: string | null;
  /** Dates the organiser set up front instead of a vote; both or neither. Locking keeps them as a default. */
  fixed_start: string | null;
  fixed_end: string | null;
};

/** The numbers behind a home card's chip and Pip line, from `trip_summaries()`. Never names. */
export type TripSummary = {
  trip_id: string;
  members: number;
  /** How many members have marked at least one free day. */
  marked: number;
  i_marked: boolean;
  /** How many members have voted for at least one place. */
  voters: number;
  i_voted: boolean;
  places: number;
};

const TRIP_COLUMNS = 'id, name, color, status, invite_code, created_at, locked_start, locked_end, fixed_start, fixed_end';

/** The trip's cover picture on the home screen: the locked place's photo, else the most-voted place's. */
export type TripCover = { tripId: string; path: string | null; url: string };

type CoverRow = { trip_id: string; image_path: string | null; image_url: string | null };

// NOTE: direct Supabase calls for now. The offline-first local store replaces these in a later step.

/** Creates a trip (I become its organiser). `fixed` sets the dates up front instead of a vote. */
export async function createTrip(name: string, color: TripColor, fixed?: { start: string; end: string } | null) {
  const row: { name: string; color: TripColor; fixed_start?: string; fixed_end?: string } = fixed
    ? { name, color, fixed_start: fixed.start, fixed_end: fixed.end }
    : { name, color };
  const { data, error } = await supabase.from('trips').insert(row).select().single();
  if (error) throw error;
  return data as Trip;
}

/** Joins a trip with its invite code and returns the trip id. Throws an Error with a user-friendly message. */
export async function joinTrip(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_trip', { code });
  if (error) {
    if (/does not match/i.test(error.message)) throw new Error("That code doesn't match a trip. Check it and try again.");
    throw new Error("Couldn't join the trip. Check your connection and try again.");
  }
  return data as string;
}

/**
 * An https link a friend can open with or without the app: the hosted web page, or the app via
 * universal / app links. Falls back to a `huddle://` link only in native dev builds with no APP_URL.
 */
export function inviteLink(code: string) {
  const path = `invite/${encodeURIComponent(code)}`;
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : undefined;
  if (origin) return `${origin}/${path}`;
  // Where the hosted web app lives, e.g. `https://huddle.expo.app`. Unset in local native development.
  const appUrl = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (appUrl) return `${appUrl}/${path}`;
  return Linking.createURL(path);
}

export type InvitePreview = { name: string; color: TripColor; members: number };

/** What a signed-out visitor may see about the trip behind an invite code; null if the code matches nothing. */
export async function invitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('invite_preview', { code });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as InvitePreview | undefined;
  return row ?? null;
}

/**
 * The invite code in whatever was pasted: the code from an invite link (`…/invite/<code>`, including
 * `huddle://invite/<code>`), otherwise the trimmed text.
 */
export function parseInviteCode(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/invite\/([^/?#\s]+)/i);
  if (!m) return trimmed;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export type NudgeKind = 'days' | 'vote';

/** The message behind "Nudge them". Counts only, never names, so it can't leak hidden marking. */
export function nudgeMessage(tripName: string, kind: NudgeKind, link: string) {
  return kind === 'days'
    ? `Quick nudge: mark the days you're free for "${tripName}" on Huddle: ${link}`
    : `Quick nudge: vote on where to go for "${tripName}" on Huddle: ${link}`;
}

export function inviteMessage(tripName: string, code: string) {
  return `Join "${tripName}" on Huddle! Use code ${code}, or open ${inviteLink(code)}`;
}

/** The text shared for a locked trip: name, dates and place. */
export function planMessage(tripName: string, dates: string, place: string) {
  return `${tripName} is locked in on Huddle! ${dates} · ${place}`;
}

/** Signs uploaded cover photos; covers whose photo can't be signed (and have no web link) are left out. */
export async function resolveCovers(rows: CoverRow[]): Promise<Map<string, TripCover>> {
  const signed = await signPhotos(rows.map((r) => r.image_path));
  const covers = new Map<string, TripCover>();
  for (const r of rows) {
    const url = (r.image_path && signed.get(r.image_path)) || r.image_url;
    if (url) covers.set(r.trip_id, { tripId: r.trip_id, path: r.image_path, url });
  }
  return covers;
}

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [covers, setCovers] = useState<Map<string, TripCover>>(new Map());
  const [summaries, setSummaries] = useState<Map<string, TripSummary>>(new Map());
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ data, error }, coverRes, summaryRes, statsRes] = await Promise.all([
      supabase.from('trips').select(TRIP_COLUMNS).order('created_at', { ascending: false }),
      supabase.from('trip_covers').select('trip_id, image_path, image_url'),
      supabase.rpc('trip_summaries'),
      supabase.from('trip_stats').select('trip_id, photo_count'),
    ]);
    setError(error ? "Couldn't load your trips. Check your connection and try again." : null);
    if (data) setTrips(data as Trip[]);
    // Summaries and photo counts only feed chips and Pip's line; on failure the cards keep the last ones.
    if (!summaryRes.error && summaryRes.data) {
      setSummaries(new Map((summaryRes.data as TripSummary[]).map((r) => [r.trip_id, r])));
    }
    if (!statsRes.error && statsRes.data) {
      setPhotoCounts(new Map((statsRes.data as { trip_id: string; photo_count: number }[]).map((r) => [r.trip_id, Number(r.photo_count)])));
    }
    // Covers are decoration: if they fail to load, the cards keep their trip colour.
    if (!coverRes.error) setCovers(await resolveCovers((coverRes.data ?? []) as CoverRow[]));
    setLoading(false);
  }, []);

  // Callers trigger `refresh` (e.g. via useFocusEffect) so the list reloads when a screen regains focus.
  return { trips, covers, summaries, photoCounts, loading, error, refresh };
}

export type TripMember = {
  user_id: string;
  role: 'organiser' | 'member';
  display_name: string;
  avatar_url: string | null;
  avatar_color: TripColor | null;
  joined_at: string;
};

export type TripDetail = Trip & {
  /** Null once the creator deletes their account. */
  created_by: string | null;
  locked_destination_id: string | null;
  /** Whether members can see who marked each day. Off means counts only. */
  show_who_marked: boolean;
  /** ISO 4217 code for the trip's money, e.g. 'INR'. */
  currency: string;
  members: TripMember[];
  /** Ranked: most votes first. */
  destinations: Destination[];
  /** How many members have marked at least one free day. */
  availabilityCount: number;
  /** The days that suit the most people, best first. */
  bestDays: BestRange[];
  /** Whether I've marked at least one free day (false when no `myId` was given). */
  iMarked: boolean;
};

type MemberRow = {
  user_id: string;
  role: TripMember['role'];
  joined_at: string;
  profiles: { display_name: string; avatar_url: string | null; avatar_color: TripColor | null } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useTrip(id: string | undefined, myId?: string) {
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // A malformed id can't match any trip; skip the query so Postgres doesn't report it as an error.
    if (!id || !UUID.test(id)) {
      setTrip(null);
      setError(null);
      setLoading(false);
      return;
    }
    const [tripRes, membersRes, destRes, votesRes, countsRes, markedRes, mineRes] = await Promise.all([
      supabase
        .from('trips')
        .select(`${TRIP_COLUMNS}, created_by, locked_destination_id, show_who_marked, currency`)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('trip_members')
        .select('user_id, role, joined_at, profiles(display_name, avatar_url, avatar_color)')
        .eq('trip_id', id)
        .order('joined_at'),
      supabase.from('destinations').select(DESTINATION_COLUMNS).eq('trip_id', id),
      supabase.from('votes').select('destination_id, user_id').eq('trip_id', id),
      // Counts and a headcount rather than rows, so this works when the trip hides who marked what.
      supabase.from('day_counts').select('day, free').eq('trip_id', id),
      supabase.rpc('marked_member_count', { t: id }),
      // Only my own rows: whether I've marked anything, which is visible whatever the trip's setting.
      myId
        ? supabase.from('availability').select('day').eq('trip_id', id).eq('user_id', myId).limit(1)
        : Promise.resolve({ data: [] as { day: string }[], error: null }),
    ]);

    const failed = tripRes.error ?? membersRes.error ?? destRes.error ?? votesRes.error ?? countsRes.error ?? markedRes.error ?? mineRes.error;
    setError(failed ? "Couldn't load this trip. Check your connection and try again." : null);

    if (!failed) {
      if (!tripRes.data) {
        // Missing trip, or RLS hid it because you're not a member.
        setTrip(null);
      } else {
        const counts = new Map<string, number>();
        for (const c of countsRes.data ?? []) counts.set(c.day, c.free);
        const members = ((membersRes.data ?? []) as unknown as MemberRow[]).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          display_name: m.profiles?.display_name ?? 'Traveller',
          avatar_url: m.profiles?.avatar_url ?? null,
          avatar_color: m.profiles?.avatar_color ?? null,
        }));
        members.sort((a, b) => Number(b.role === 'organiser') - Number(a.role === 'organiser'));
        const places = await withPhotos((destRes.data ?? []) as DestinationRow[]);
        setTrip({
          ...(tripRes.data as Omit<TripDetail, 'members' | 'destinations' | 'availabilityCount' | 'bestDays' | 'iMarked'>),
          members,
          destinations: rankDestinations(places, votesRes.data ?? [], myId),
          availabilityCount: Number(markedRes.data ?? 0),
          bestDays: bestRanges(counts, today()),
          iMarked: (mineRes.data?.length ?? 0) > 0,
        });
      }
    }
    setLoading(false);
  }, [id, myId]);

  return { trip, loading, error, refresh };
}

/** Shows or hides who marked each day for everyone in the trip (organisers only; RLS enforces it). */
export async function setShowWhoMarked(id: string, show: boolean) {
  const { data, error } = await supabase.from('trips').update({ show_who_marked: show }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not changed');
}

export type TripPatch = Partial<{ name: string; color: TripColor; fixed_start: string | null; fixed_end: string | null }>;

/**
 * Changes a trip's name, colour or fixed dates (organisers only; RLS enforces it). Pass both fixed dates,
 * or both as null to go back to letting the group vote.
 */
export async function updateTrip(id: string, patch: TripPatch) {
  const { error } = await supabase.from('trips').update(patch).eq('id', id);
  if (error) throw error;
}

export async function renameTrip(id: string, name: string) {
  await updateTrip(id, { name });
}

/**
 * Deletes the trip for everyone (days, places and votes cascade). Organisers only; RLS enforces it.
 * Its photos go first, since storage only lets an organiser of an existing trip remove them.
 */
export async function deleteTrip(id: string) {
  await removeTripPhotos(id);
  const { data, error } = await supabase.from('trips').delete().eq('id', id).select('id');
  if (error) throw error;
  // RLS hides rows you can't delete instead of erroring, so an empty result means nothing happened.
  if (!data?.length) throw new Error('Not deleted');
  deleteLocalTrip(id);
}

/** Leaves a trip. The database also clears your free days and votes, and refuses if you're the last organiser. */
export async function leaveTrip(tripId: string, userId: string) {
  const { data, error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId).select('user_id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not a member');
  deleteLocalTrip(tripId);
}

/** Locks the trip to these dates and this destination (organiser only; the database checks everything). */
export async function lockTrip(tripId: string, start: string, end: string, destinationId: string) {
  const { error } = await supabase.rpc('lock_trip', { t: tripId, start_day: start, end_day: end, destination: destinationId });
  if (error) throw error;
}

/** Puts a locked trip back into planning; days, places and votes stay (organiser only). */
export async function unlockTrip(tripId: string) {
  const { error } = await supabase.rpc('unlock_trip', { t: tripId });
  if (error) throw error;
}

/** Removes a member from the trip (organisers only, and never another organiser; RLS enforces it). */
export async function removeMember(tripId: string, userId: string) {
  const { data, error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId).select('user_id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not removed');
}

/** The name of the place with the most votes (earliest suggested wins a tie), or null when nobody has voted. */
export async function leadingPlaceName(tripId: string): Promise<string | null> {
  const [destRes, votesRes] = await Promise.all([
    supabase.from('destinations').select('id, title, created_at').eq('trip_id', tripId),
    supabase.from('votes').select('destination_id, user_id').eq('trip_id', tripId),
  ]);
  if (destRes.error || votesRes.error || !destRes.data?.length) return null;
  // Ranking only reads id and created_at, so the slim rows rank the same as full ones.
  const rows = destRes.data as unknown as DestinationRow[];
  const [top] = rankDestinations(rows, (votesRes.data ?? []) as { destination_id: string; user_id: string }[], undefined);
  return top && top.voteCount > 0 ? top.title : null;
}
