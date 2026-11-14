import { useCallback, useState } from 'react';

import { deleteLocalTrip, removeTripPhotos } from './place-photo';
import { supabase } from './supabase';

/** What deleting my account does to one of my trips (from `account_deletion_preview()`). */
export type TripOutcome = {
  trip_id: string;
  trip_name: string;
  outcome: 'handed_over' | 'deleted' | 'left';
  new_organiser: string | null;
};

/** The word typed to confirm. */
export const CONFIRM_WORD = 'DELETE';

/** One line per trip for the confirmation screen. */
export function describeOutcome(t: TripOutcome): string {
  if (t.outcome === 'deleted') return `${t.trip_name} will be deleted. Nobody else is in it.`;
  if (t.outcome === 'handed_over') return `${t.trip_name} passes to ${t.new_organiser ?? 'another member'} as organiser.`;
  return `You’ll leave ${t.trip_name}. Everyone else keeps it.`;
}

export function useDeletionPreview() {
  const [trips, setTrips] = useState<TripOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('account_deletion_preview');
    setError(error ? "Couldn't load your trips. Check your connection and try again." : null);
    if (!error) setTrips((data as TripOutcome[] | null) ?? []);
  }, []);

  return { trips, error, refresh };
}

const DELETE_FAILED = "Couldn't delete your account. Check your connection and try again.";

/**
 * Deletes the signed-in account, then forgets the session on this device. The server-side session is
 * already gone with the user, so the sign-out is local only. Signing out sends the app back to sign-in.
 *
 * The trips that go with the account (nobody else is in them) lose their photos first: the database
 * can't remove storage files, and once those trips are gone nobody could.
 */
export async function deleteMyAccount() {
  const { data, error: previewError } = await supabase.rpc('account_deletion_preview');
  if (previewError) throw new Error(DELETE_FAILED);
  try {
    for (const t of (data as TripOutcome[] | null) ?? []) {
      if (t.outcome === 'deleted') {
        await removeTripPhotos(t.trip_id);
        deleteLocalTrip(t.trip_id);
      }
    }
  } catch {
    throw new Error(DELETE_FAILED);
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(DELETE_FAILED);
  await supabase.auth.signOut({ scope: 'local' });
}
