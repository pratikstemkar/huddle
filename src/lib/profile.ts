import { useCallback, useState } from 'react';

import type { TripColor } from '@/theme/tokens';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: TripColor | null;
};

export const MAX_NAME = 40;

/** Loads my own profile row. `profile` stays null until loaded (or if the row is missing). */
export function useMyProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, avatar_color')
      .eq('id', userId)
      .maybeSingle();
    setError(error ? "Couldn't load your profile. Check your connection and try again." : null);
    if (data) setProfile(data as Profile);
    setLoading(false);
  }, [userId]);

  return { profile, loading, error, refresh };
}

/** Updates my name, photo and avatar colour. RLS only lets you edit your own row. */
export async function updateProfile(userId: string, patch: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'avatar_color'>>) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Not updated');
}
