import { randomUUID } from 'expo-crypto';
import { useCallback, useState } from 'react';

import { deleteLocalCopy, keepLocalCopy, removePhotos, signPhotos, uploadPhoto } from './place-photo';
import { supabase } from './supabase';

/** The columns every destinations query selects. */
export const DESTINATION_COLUMNS = 'id, trip_id, title, note, url, image_url, image_path, created_by, created_at';

export type Destination = {
  id: string;
  trip_id: string;
  title: string;
  note: string | null;
  url: string | null;
  /** A web image link (places added before photo uploads). */
  image_url: string | null;
  /** The uploaded photo's path in the `place-photos` bucket. */
  image_path: string | null;
  /** What to show: a signed link to the uploaded photo, else `image_url`. */
  photoUrl: string | null;
  /** Null once the author deletes their account. */
  created_by: string | null;
  created_at: string;
  /** How many members voted for it. */
  voteCount: number;
  /** Who voted (user ids). */
  voters: string[];
  /** Whether I voted for it. */
  iVoted: boolean;
};

export type DestinationRow = Omit<Destination, 'voteCount' | 'voters' | 'iVoted' | 'photoUrl'> & { photoUrl?: string | null };
type VoteRow = { destination_id: string; user_id: string };

/** Destinations with their votes, most votes first and oldest first among ties. */
export function rankDestinations(rows: DestinationRow[], votes: VoteRow[], me: string | undefined): Destination[] {
  const voters = new Map<string, string[]>();
  for (const v of votes) {
    const list = voters.get(v.destination_id);
    if (list) list.push(v.user_id);
    else voters.set(v.destination_id, [v.user_id]);
  }
  return rows
    .map((d) => {
      const list = voters.get(d.id) ?? [];
      return { ...d, photoUrl: d.photoUrl ?? d.image_url, voteCount: list.length, voters: list, iVoted: me !== undefined && list.includes(me) };
    })
    .sort((a, b) => b.voteCount - a.voteCount || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

/** Adds `photoUrl` to each row: a signed link for uploaded photos, or the web image link. */
export async function withPhotos<T extends Pick<Destination, 'image_path' | 'image_url'>>(rows: T[]): Promise<(T & { photoUrl: string | null })[]> {
  const signed = await signPhotos(rows.map((r) => r.image_path));
  return rows.map((r) => ({ ...r, photoUrl: (r.image_path && signed.get(r.image_path)) || r.image_url }));
}

export type SuggestionInput = {
  title: string;
  note?: string;
  url?: string;
  /** A photo already cropped and resized by `preparePhoto`, on the device. */
  photoUri?: string;
};

/** Adds https:// when missing and returns null for anything that isn't a web link. */
export function normaliseUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.') || withScheme.length > 2048) return null;
    return withScheme;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Saves a suggestion. With a photo, uploads it first (under the new place's id), then saves the place,
 * and removes the photo again if saving the place fails. Keeps a copy of the photo on the device.
 */
export async function suggestDestination(tripId: string, input: SuggestionInput) {
  const id = randomUUID();
  const imagePath = input.photoUri ? await uploadPhoto(tripId, id, input.photoUri) : null;
  const { error } = await supabase.from('destinations').insert({
    id,
    trip_id: tripId,
    title: input.title,
    note: input.note || null,
    url: input.url || null,
    image_path: imagePath,
  });
  if (error) {
    if (imagePath) await removePhotos([imagePath]).catch(() => {});
    throw error;
  }
  if (input.photoUri) keepLocalCopy(tripId, id, input.photoUri);
  return id;
}

export function useDestinations(tripId: string | undefined, me: string | undefined) {
  const [list, setList] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const [destRes, votesRes] = await Promise.all([
      supabase.from('destinations').select(DESTINATION_COLUMNS).eq('trip_id', tripId),
      supabase.from('votes').select('destination_id, user_id').eq('trip_id', tripId),
    ]);
    if (destRes.error || votesRes.error) setError("Couldn't load the places. Check your connection and try again.");
    else {
      setError(null);
      const rows = await withPhotos((destRes.data ?? []) as DestinationRow[]);
      setList(rankDestinations(rows, votesRes.data ?? [], me));
    }
    setLoading(false);
  }, [tripId, me]);

  /** Votes or un-votes. Updates the screen straight away and rolls back if saving fails. */
  const toggleVote = useCallback(
    async (destinationId: string) => {
      if (!tripId || !me) return;
      const current = list.find((d) => d.id === destinationId);
      if (!current) return;
      const vote = !current.iVoted;
      const apply = (on: boolean) =>
        setList((prev) => {
          const rows = prev.map((d) => {
            if (d.id !== destinationId) return d;
            const voters = on ? [...d.voters.filter((u) => u !== me), me] : d.voters.filter((u) => u !== me);
            return { ...d, voters, voteCount: voters.length, iVoted: on };
          });
          return rows.sort((a, b) => b.voteCount - a.voteCount || (a.created_at < b.created_at ? -1 : 1));
        });

      apply(vote);
      setError(null);
      const res = vote
        ? await supabase.from('votes').upsert({ destination_id: destinationId, trip_id: tripId, user_id: me }, { onConflict: 'destination_id,user_id', ignoreDuplicates: true })
        : await supabase.from('votes').delete().eq('destination_id', destinationId).eq('user_id', me);
      if (res.error) {
        apply(!vote);
        setError("Couldn't save your vote. Check your connection and try again.");
      }
    },
    [tripId, me, list],
  );

  const remove = useCallback(
    async (destinationId: string) => {
      const place = list.find((d) => d.id === destinationId);
      const { error } = await supabase.from('destinations').delete().eq('id', destinationId);
      if (error) {
        setError("Couldn't remove that place. Check your connection and try again.");
        return;
      }
      setError(null);
      setList((prev) => prev.filter((d) => d.id !== destinationId));
      if (place?.image_path) {
        removePhotos([place.image_path]).catch(() => {});
        deleteLocalCopy(place.trip_id, place.id);
      }
    },
    [list],
  );

  return { list, loading, error, refresh, toggleVote, remove };
}
