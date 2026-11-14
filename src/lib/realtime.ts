import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from './supabase';

const DEBOUNCE_MS = 250;
let instances = 0;

export type LiveTable =
  | 'availability'
  | 'day_counts'
  | 'destinations'
  | 'votes'
  | 'trip_members'
  | 'trips'
  | 'itinerary_items'
  | 'expenses'
  | 'settlements'
  | 'trip_photos';

/** Everything a trip has; the default when a screen doesn't say what it shows. */
export const ALL_LIVE_TABLES: LiveTable[] = [
  'availability',
  'day_counts',
  'destinations',
  'votes',
  'trip_members',
  'trips',
  'itinerary_items',
  'expenses',
  'settlements',
  'trip_photos',
];

/** Tables whose deleted rows keep their trip_id (it's part of the primary key), so deletes can be checked. */
const DELETE_HAS_TRIP: LiveTable[] = ['availability', 'day_counts', 'trip_members'];
/** Tables whose deleted rows carry only their id: any delete reloads (cheap, debounced). */
const DELETE_ANY: LiveTable[] = ['votes', 'destinations', 'itinerary_items', 'expenses', 'settlements', 'trip_photos'];

/**
 * Calls `onChange` shortly after anyone changes this trip's data in `tables` (default: all of it).
 * Events are only a "something changed" signal; the caller reloads its data, so ranking stays in one place.
 * Also reloads once after a dropped connection comes back, and when the app returns to the foreground.
 */
export function useTripLive(tripId: string | undefined, onChange: () => void, tables: LiveTable[] = ALL_LIVE_TABLES) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  // Callers usually pass a new array each render; only its contents matter.
  const key = [...new Set(tables)].sort().join(',');

  useEffect(() => {
    if (!tripId) return;
    const watch = new Set(key.split(',') as LiveTable[]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), DEBOUNCE_MS);
    };

    const byTrip = `trip_id=eq.${tripId}`;
    // Screens stack (trip page under settings), so each subscription needs its own channel name;
    // supabase-js hands back the same, already-subscribed channel for a repeated name.
    const channel = supabase.channel(`trip:${tripId}:${++instances}`);
    for (const table of ['availability', 'day_counts', 'destinations', 'votes', 'trip_members', 'itinerary_items', 'expenses', 'settlements', 'trip_photos'] as const) {
      if (watch.has(table)) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: byTrip }, fire);
    }
    if (watch.has('trips')) {
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, fire);
    }
    // Day counts change in place as people mark days; this is the only signal when the trip hides who marked what.
    // Plan items, expenses (and with them their shares) are edited in place too.
    for (const table of ['day_counts', 'itinerary_items', 'expenses'] as const) {
      if (watch.has(table)) channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: byTrip }, fire);
    }
    // Deletes can't be filtered (the table keeps only primary keys for old rows, by design), so check here.
    for (const table of DELETE_HAS_TRIP) {
      if (!watch.has(table)) continue;
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, (p) => {
        const old = p.old as { trip_id?: string };
        if (!old.trip_id || old.trip_id === tripId) fire();
      });
    }
    // A deleted trip only carries its id, so match on that.
    if (watch.has('trips')) {
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trips' }, (p) => {
        if ((p.old as { id?: string }).id === tripId) fire();
      });
    }
    for (const table of DELETE_ANY) {
      if (watch.has(table)) channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, fire);
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
  }, [tripId, key]);
}
