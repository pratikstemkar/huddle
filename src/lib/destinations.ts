import { useCallback, useState } from 'react';

import { supabase } from './supabase';

export type Destination = {
  id: string;
  title: string;
  note: string | null;
  url: string | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  /** How many members voted for it. */
  voteCount: number;
  /** Who voted (user ids). */
  voters: string[];
  /** Whether I voted for it. */
  iVoted: boolean;
};

type DestinationRow = Omit<Destination, 'voteCount' | 'voters' | 'iVoted'>;
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
      return { ...d, voteCount: list.length, voters: list, iVoted: me !== undefined && list.includes(me) };
    })
    .sort((a, b) => b.voteCount - a.voteCount || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

export type SuggestionInput = { title: string; note?: string; url?: string; imageUrl?: string };

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

export async function suggestDestination(tripId: string, input: SuggestionInput) {
  const { error } = await supabase.from('destinations').insert({
    trip_id: tripId,
    title: input.title,
    note: input.note || null,
    url: input.url || null,
    image_url: input.imageUrl || null,
  });
  if (error) throw error;
}

export function useDestinations(tripId: string | undefined, me: string | undefined) {
  const [list, setList] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const [destRes, votesRes] = await Promise.all([
      supabase.from('destinations').select('id, title, note, url, image_url, created_by, created_at').eq('trip_id', tripId),
      supabase.from('votes').select('destination_id, user_id').eq('trip_id', tripId),
    ]);
    if (destRes.error || votesRes.error) setError("Couldn't load the places. Check your connection and try again.");
    else {
      setError(null);
      setList(rankDestinations(destRes.data ?? [], votesRes.data ?? [], me));
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
      const { error } = await supabase.from('destinations').delete().eq('id', destinationId);
      if (error) {
        setError("Couldn't remove that place. Check your connection and try again.");
        return;
      }
      setError(null);
      setList((prev) => prev.filter((d) => d.id !== destinationId));
    },
    [],
  );

  return { list, loading, error, refresh, toggleVote, remove };
}
