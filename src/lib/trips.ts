import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import type { TripColor } from '@/theme/tokens';
import { bestRanges, type BestRange } from './availability';
import { today } from './dates';
import { rankDestinations, type Destination } from './destinations';
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
};

// NOTE: direct Supabase calls for now. The offline-first local store replaces these in a later step.

export async function createTrip(name: string, color: TripColor) {
  const { data, error } = await supabase.from('trips').insert({ name, color }).select().single();
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

export function inviteMessage(tripName: string, code: string) {
  return `Join "${tripName}" on Huddle! Use code ${code}, or open ${inviteLink(code)}`;
}

/** The text shared for a locked trip: name, dates and place. */
export function planMessage(tripName: string, dates: string, place: string) {
  return `${tripName} is locked in on Huddle! ${dates} · ${place}`;
}

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('id, name, color, status, invite_code, created_at, locked_start, locked_end')
      .order('created_at', { ascending: false });
    setError(error ? "Couldn't load your trips. Pull to retry." : null);
    if (data) setTrips(data as Trip[]);
    setLoading(false);
  }, []);

  // Callers trigger `refresh` (e.g. via useFocusEffect) so the list reloads when a screen regains focus.
  return { trips, loading, error, refresh };
}

export type TripMember = {
  user_id: string;
  role: 'organiser' | 'member';
  display_name: string;
  avatar_url: string | null;
  avatar_color: TripColor | null;
};

export type TripDetail = Trip & {
  created_by: string;
  locked_destination_id: string | null;
  /** Whether members can see who marked each day. Off means counts only. */
  show_who_marked: boolean;
  members: TripMember[];
  /** Ranked: most votes first. */
  destinations: Destination[];
  /** How many members have marked at least one free day. */
  availabilityCount: number;
  /** The days that suit the most people, best first. */
  bestDays: BestRange[];
};

type MemberRow = {
  user_id: string;
  role: TripMember['role'];
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
    const [tripRes, membersRes, destRes, votesRes, countsRes, markedRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id, name, color, status, invite_code, created_at, created_by, locked_start, locked_end, locked_destination_id, show_who_marked')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('trip_members').select('user_id, role, profiles(display_name, avatar_url, avatar_color)').eq('trip_id', id).order('joined_at'),
      supabase.from('destinations').select('id, title, note, url, image_url, created_by, created_at').eq('trip_id', id),
      supabase.from('votes').select('destination_id, user_id').eq('trip_id', id),
      // Counts and a headcount rather than rows, so this works when the trip hides who marked what.
      supabase.from('day_counts').select('day, free').eq('trip_id', id),
      supabase.rpc('marked_member_count', { t: id }),
    ]);

    const failed = tripRes.error ?? membersRes.error ?? destRes.error ?? votesRes.error ?? countsRes.error ?? markedRes.error;
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
          display_name: m.profiles?.display_name ?? 'Traveller',
          avatar_url: m.profiles?.avatar_url ?? null,
          avatar_color: m.profiles?.avatar_color ?? null,
        }));
        members.sort((a, b) => Number(b.role === 'organiser') - Number(a.role === 'organiser'));
        setTrip({
          ...(tripRes.data as Omit<TripDetail, 'members' | 'destinations' | 'availabilityCount' | 'bestDays'>),
          members,
          destinations: rankDestinations(destRes.data ?? [], votesRes.data ?? [], myId),
          availabilityCount: Number(markedRes.data ?? 0),
          bestDays: bestRanges(counts, today()),
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

export async function renameTrip(id: string, name: string) {
  const { error } = await supabase.from('trips').update({ name }).eq('id', id);
  if (error) throw error;
}

/** Deletes the trip for everyone (days, places and votes cascade). Organisers only; RLS enforces it. */
export async function deleteTrip(id: string) {
  const { data, error } = await supabase.from('trips').delete().eq('id', id).select('id');
  if (error) throw error;
  // RLS hides rows you can't delete instead of erroring, so an empty result means nothing happened.
  if (!data?.length) throw new Error('Not deleted');
}

/** Leaves a trip. The database also clears your free days and votes, and refuses if you're the last organiser. */
export async function leaveTrip(tripId: string, userId: string) {
  const { data, error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId).select('user_id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not a member');
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
