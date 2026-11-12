import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';

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

export function inviteLink(code: string) {
  return Linking.createURL('join', { queryParams: { code } });
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
    const [tripRes, membersRes, destRes, votesRes, availRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id, name, color, status, invite_code, created_at, created_by, locked_start, locked_end, locked_destination_id')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('trip_members').select('user_id, role, profiles(display_name, avatar_url, avatar_color)').eq('trip_id', id).order('joined_at'),
      supabase.from('destinations').select('id, title, note, url, image_url, created_by, created_at').eq('trip_id', id),
      supabase.from('votes').select('destination_id, user_id').eq('trip_id', id),
      supabase.from('availability').select('user_id, day').eq('trip_id', id),
    ]);

    const failed = tripRes.error ?? membersRes.error ?? destRes.error ?? votesRes.error ?? availRes.error;
    setError(failed ? "Couldn't load this trip. Check your connection and try again." : null);

    if (!failed) {
      if (!tripRes.data) {
        // Missing trip, or RLS hid it because you're not a member.
        setTrip(null);
      } else {
        const counts = new Map<string, number>();
        for (const a of availRes.data ?? []) counts.set(a.day, (counts.get(a.day) ?? 0) + 1);
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
          availabilityCount: new Set((availRes.data ?? []).map((a) => a.user_id)).size,
          bestDays: bestRanges(counts, today()),
        });
      }
    }
    setLoading(false);
  }, [id, myId]);

  return { trip, loading, error, refresh };
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
