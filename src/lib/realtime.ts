import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from './supabase';

const DEBOUNCE_MS = 250;

/**
 * Calls `onChange` shortly after anyone changes this trip's days, places, votes, members or the trip itself.
 * Events are only a "something changed" signal; the caller reloads its data, so ranking stays in one place.
 * Also reloads once after a dropped connection comes back, and when the app returns to the foreground.
 */
export function useTripLive(tripId: string | undefined, onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    if (!tripId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), DEBOUNCE_MS);
    };

    const byTrip = `trip_id=eq.${tripId}`;
    const channel = supabase.channel(`trip:${tripId}`);
    for (const table of ['availability', 'destinations', 'votes', 'trip_members']) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: byTrip }, fire);
    }
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, fire);
    // Deletes can't be filtered (the table keeps only primary keys for old rows, by design), so check here.
    // Availability and members keys include trip_id; votes and destinations don't, so those just reload (cheap, debounced).
    for (const table of ['availability', 'trip_members']) {
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => {
        const old = p.old as { trip_id?: string };
        if (!old.trip_id || old.trip_id === tripId) fire();
      });
    }
    for (const table of ['votes', 'destinations']) {
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, fire);
    }

    let wasDown = false;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (wasDown) fire();
        wasDown = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDown = true;
      }
    });

    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', (s) => s === 'active' && fire());

    return () => {
      clearTimeout(timer);
      appState?.remove();
      supabase.removeChannel(channel);
    };
  }, [tripId]);
}
