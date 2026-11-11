import { useCallback, useState } from 'react';

import type { TripColor } from '@/theme/tokens';
import { supabase } from './supabase';

export type Trip = {
  id: string;
  name: string;
  color: TripColor;
  status: 'planning' | 'locked';
  invite_code: string;
  created_at: string;
};

// NOTE: direct Supabase calls for now. The offline-first local store replaces these in a later step.

export async function createTrip(name: string, color: TripColor) {
  const { data, error } = await supabase.from('trips').insert({ name, color }).select().single();
  if (error) throw error;
  return data as Trip;
}

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('id, name, color, status, invite_code, created_at')
      .order('created_at', { ascending: false });
    setError(error ? "Couldn't load your trips. Pull to retry." : null);
    if (data) setTrips(data as Trip[]);
    setLoading(false);
  }, []);

  // Callers trigger `refresh` (e.g. via useFocusEffect) so the list reloads when a screen regains focus.
  return { trips, loading, error, refresh };
}
