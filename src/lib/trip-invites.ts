import { useCallback, useState } from 'react';

import { toTripColor, type TripColor } from '@/theme/tokens';
import { supabase } from './supabase';
import type { GroupPerson } from './groups';

/** A trip invite waiting on me: which trip, who asked, and whether its dates are already set. */
export type TripInvite = {
  trip_id: string;
  trip_name: string;
  trip_color: TripColor;
  members: number;
  datesSet: boolean;
  from: string;
  created_at: string;
};

/** Someone the organiser has invited to a trip who hasn't answered yet. */
export type PendingTripInvite = GroupPerson & { invited_at: string };

type InviteRow = { trip_id: string; trip_name: string; trip_color: string; members: number; dates_set: boolean; from_name: string; created_at: string };
type PendingRow = {
  user_id: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null; avatar_color: string | null } | null;
};

function friendly(error: { message: string } | null, fallback: string): Error {
  if (error && /no longer there/i.test(error.message)) return new Error('That invite is no longer there.');
  return new Error(fallback);
}

/** Invites people (usually a group's members) to a trip. Organisers only. */
export async function inviteToTrip(tripId: string, userIds: string[]) {
  const { error } = await supabase.rpc('invite_to_trip', { t: tripId, user_ids: userIds });
  if (error) throw friendly(error, "Couldn't send the invites. Check your connection and try again.");
}

/** Joins the trip an invite is for and returns its id. */
export async function acceptTripInvite(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_trip_invite', { t: tripId });
  if (error) throw friendly(error, "Couldn't join the trip. Check your connection and try again.");
  return data as string;
}

/** Declines my own invite, or (as an organiser) cancels someone else's. */
export async function removeTripInvite(tripId: string, userId: string) {
  const { error } = await supabase.from('trip_invites').delete().eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw friendly(error, "Couldn't remove the invite. Check your connection and try again.");
}

/** The trip invites waiting on me. Callers trigger `refresh`. */
export function useMyTripInvites() {
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_trip_invites');
    setError(error ? "Couldn't load your trip invites. Check your connection and try again." : null);
    if (!error) {
      setInvites(
        ((data ?? []) as InviteRow[]).map((r) => ({
          trip_id: r.trip_id,
          trip_name: r.trip_name,
          trip_color: toTripColor(r.trip_color),
          members: Number(r.members),
          datesSet: r.dates_set,
          from: r.from_name,
          created_at: r.created_at,
        })),
      );
    }
  }, []);
  return { invites, error, refresh };
}

/** People invited to this trip who haven't answered yet (visible to its members). */
export function usePendingTripInvites(tripId: string | undefined) {
  const [pending, setPending] = useState<PendingTripInvite[]>([]);
  const refresh = useCallback(async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from('trip_invites')
      .select('user_id, created_at, profiles!trip_invites_user_id_fkey(display_name, avatar_url, avatar_color)')
      .eq('trip_id', tripId)
      .order('created_at');
    if (error) return;
    setPending(
      ((data ?? []) as unknown as PendingRow[]).map((r) => ({
        user_id: r.user_id,
        display_name: r.profiles?.display_name ?? 'Someone',
        avatar_url: r.profiles?.avatar_url ?? null,
        avatar_color: r.profiles?.avatar_color ? toTripColor(r.profiles.avatar_color) : null,
        invited_at: r.created_at,
      })),
    );
  }, [tripId]);
  return { pending, refresh };
}
