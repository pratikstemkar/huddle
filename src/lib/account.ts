import { useCallback, useState } from 'react';

import { ALBUM_BUCKET, deleteLocalTrip, removeTripPhotos } from './place-photo';
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
/** PostgREST returns at most this many rows per request, and storage removes at most this many files. */
const PAGE = 1000;

/** Every album file I uploaded, in any trip I'm still in. */
async function myAlbumFiles(me: string): Promise<string[]> {
  const paths: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('trip_photos')
      .select('path, thumb_path')
      .eq('uploaded_by', me)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { path: string; thumb_path: string }[];
    for (const r of rows) paths.push(r.path, r.thumb_path);
    if (rows.length < PAGE) return paths;
  }
}

async function removeMyAlbumFiles(me: string) {
  const paths = await myAlbumFiles(me);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await supabase.storage.from(ALBUM_BUCKET).remove(paths.slice(i, i + PAGE));
    if (error) throw error;
  }
}

/**
 * Deletes the signed-in account, then forgets the session on this device. The server-side session is
 * already gone with the user, so the sign-out is local only. Signing out sends the app back to sign-in.
 *
 * The trips that go with the account (nobody else is in them) lose their photos first, and so do the
 * album photos I added to other trips (deleting the account deletes those rows): the database can't
 * remove storage files, and once the rows or trips are gone nobody could find them.
 */
export async function deleteMyAccount() {
  const { data, error: previewError } = await supabase.rpc('account_deletion_preview');
  if (previewError) throw new Error(DELETE_FAILED);
  try {
    const { data: auth } = await supabase.auth.getSession();
    const me = auth.session?.user.id;
    if (me) await removeMyAlbumFiles(me);
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
