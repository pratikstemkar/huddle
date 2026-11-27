import { useCallback, useState } from 'react';

import type { TripColor } from '@/theme/tokens';
import { addDays, type Day } from './dates';
import { supabase } from './supabase';

/** A destination in the ready-made trips catalog. */
export type CatalogDestination = {
  id: string;
  name: string;
  country: string;
  region: 'india' | 'abroad';
  tags: string[];
  blurb: string;
  /** An Unsplash image without size params; see `coverUrl`. */
  cover_url: string;
  /** The photographer, for the "Photo: … on Unsplash" line. */
  photo_credit: string;
  sort: number;
};

export type CatalogItinerary = {
  id: string;
  destination_id: string;
  title: string;
  summary: string;
  nights: number;
  pace: 'easy' | 'balanced' | 'packed';
  sort: number;
};

export type CatalogItem = {
  id: string;
  itinerary_id: string;
  /** 0 is the trip's first day. */
  day_index: number;
  /** `HH:MM:SS`. */
  start_time: string;
  title: string;
  note: string | null;
};

export type DestinationCard = CatalogDestination & { plans: number; shortest: number | null; longest: number | null };

const DESTINATION_COLUMNS = 'id, name, country, region, tags, blurb, cover_url, photo_credit, sort';
const ITINERARY_COLUMNS = 'id, destination_id, title, summary, nights, pace, sort';
const ITEM_COLUMNS = 'id, itinerary_id, day_index, start_time, title, note';

const LOAD_ERROR = "Couldn't load trip ideas. Check your connection and try again.";

export type CatalogFilter = 'all' | 'india' | 'abroad' | 'beach' | 'mountains';

export const CATALOG_FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'india', label: 'India' },
  { key: 'abroad', label: 'Abroad' },
  { key: 'beach', label: 'Beaches' },
  { key: 'mountains', label: 'Mountains' },
];

export const PACE_LABEL: Record<CatalogItinerary['pace'], string> = { easy: 'Easy pace', balanced: 'Balanced', packed: 'Packed' };

/** A sized Unsplash link for a catalog cover. */
export function coverUrl(base: string, width: number, height?: number) {
  const size = height ? `&h=${height}` : '';
  return `${base}?auto=format&fit=crop&w=${width}${size}&q=70`;
}

export function filterDestinations<T extends Pick<CatalogDestination, 'region' | 'tags'>>(list: T[], filter: CatalogFilter): T[] {
  if (filter === 'all') return list;
  if (filter === 'india' || filter === 'abroad') return list.filter((d) => d.region === filter);
  return list.filter((d) => d.tags.includes(filter));
}

export const nightsLabel = (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`;
export const daysLabel = (nights: number) => `${nights + 1} days`;

/** "2–4 nights" or "3 nights" for a destination card; null when it has no plans. */
export function lengthRange(shortest: number | null, longest: number | null) {
  if (shortest == null || longest == null) return null;
  return shortest === longest ? nightsLabel(shortest) : `${shortest}–${longest} nights`;
}

/** The last day of a trip that starts on `start` and lasts `nights` nights. */
export function templateEnd(start: Day, nights: number): Day {
  return addDays(start, nights);
}

/** Items grouped by day (0 first), each day in time order. Days with no items are left out. */
export function itemsByDay(items: CatalogItem[]): { day: number; items: CatalogItem[] }[] {
  const days = new Map<number, CatalogItem[]>();
  for (const it of items) days.set(it.day_index, [...(days.get(it.day_index) ?? []), it]);
  return [...days.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, list]) => ({ day, items: list.sort((a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0)) }));
}

/**
 * A few things the plan is about, for its card: the first item of each day between arrival and the
 * last day (which are mostly check-in and travel), in day order.
 */
export function highlights(items: CatalogItem[], nights: number, n = 3): string[] {
  const days = itemsByDay(items).filter((d) => d.day > 0 && d.day < nights);
  return days.slice(0, n).map((d) => d.items[0].title);
}

/** Destinations with how many plans each has and their lengths, in catalog order. */
export function destinationCards(destinations: CatalogDestination[], itineraries: Pick<CatalogItinerary, 'destination_id' | 'nights'>[]): DestinationCard[] {
  return [...destinations]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map((d) => {
      const nights = itineraries.filter((i) => i.destination_id === d.id).map((i) => i.nights);
      return {
        ...d,
        plans: nights.length,
        shortest: nights.length ? Math.min(...nights) : null,
        longest: nights.length ? Math.max(...nights) : null,
      };
    })
    .filter((d) => d.plans > 0);
}

/** Every destination that has at least one plan, for the Explore grid and the home ideas row. Call `refresh` to load. */
export function useCatalog() {
  const [destinations, setDestinations] = useState<DestinationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [destRes, itRes] = await Promise.all([
      supabase.from('catalog_destinations').select(DESTINATION_COLUMNS).order('sort'),
      supabase.from('catalog_itineraries').select('destination_id, nights'),
    ]);
    const failed = destRes.error ?? itRes.error;
    setError(failed ? LOAD_ERROR : null);
    if (!failed) {
      setDestinations(
        destinationCards(
          (destRes.data ?? []) as CatalogDestination[],
          (itRes.data ?? []) as Pick<CatalogItinerary, 'destination_id' | 'nights'>[],
        ),
      );
    }
    setLoading(false);
  }, []);

  return { destinations, loading, error, refresh };
}

export type ItineraryWithItems = CatalogItinerary & { items: CatalogItem[] };

/** One destination with its plans and every plan's items. Call `refresh` to load. */
export function useCatalogDestination(id: string | undefined) {
  const [destination, setDestination] = useState<CatalogDestination | null>(null);
  const [itineraries, setItineraries] = useState<ItineraryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const [destRes, itRes] = await Promise.all([
      supabase.from('catalog_destinations').select(DESTINATION_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('catalog_itineraries').select(ITINERARY_COLUMNS).eq('destination_id', id).order('sort'),
    ]);
    let failed = destRes.error ?? itRes.error;
    const plans = (itRes.data ?? []) as CatalogItinerary[];
    let items: CatalogItem[] = [];
    if (!failed && plans.length) {
      const itemsRes = await supabase
        .from('catalog_itinerary_items')
        .select(ITEM_COLUMNS)
        .in(
          'itinerary_id',
          plans.map((p) => p.id),
        );
      failed = itemsRes.error;
      items = (itemsRes.data ?? []) as CatalogItem[];
    }
    setError(failed ? LOAD_ERROR : null);
    if (!failed) {
      setDestination((destRes.data as CatalogDestination | null) ?? null);
      setItineraries(plans.map((p) => ({ ...p, items: items.filter((i) => i.itinerary_id === p.id) })));
    }
    setLoading(false);
  }, [id]);

  return { destination, itineraries, loading, error, refresh };
}

/** One plan with its destination and items. Call `refresh` to load. */
export function useCatalogItinerary(id: string | undefined) {
  const [itinerary, setItinerary] = useState<ItineraryWithItems | null>(null);
  const [destination, setDestination] = useState<CatalogDestination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const [itRes, itemsRes] = await Promise.all([
      supabase.from('catalog_itineraries').select(ITINERARY_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('catalog_itinerary_items').select(ITEM_COLUMNS).eq('itinerary_id', id),
    ]);
    let failed = itRes.error ?? itemsRes.error;
    const plan = (itRes.data as CatalogItinerary | null) ?? null;
    let dest: CatalogDestination | null = null;
    if (!failed && plan) {
      const destRes = await supabase.from('catalog_destinations').select(DESTINATION_COLUMNS).eq('id', plan.destination_id).maybeSingle();
      failed = destRes.error;
      dest = (destRes.data as CatalogDestination | null) ?? null;
    }
    setError(failed ? LOAD_ERROR : null);
    if (!failed) {
      setItinerary(plan ? { ...plan, items: (itemsRes.data ?? []) as CatalogItem[] } : null);
      setDestination(dest);
    }
    setLoading(false);
  }, [id]);

  return { itinerary, destination, loading, error, refresh };
}

export type TemplateTripInput = {
  itineraryId: string;
  name: string;
  color: TripColor;
  start: Day;
  groupId?: string | null;
};

/**
 * Creates a trip from a ready-made plan: dates fixed from `start`, the destination as its place and the
 * plan copied onto its days. Returns the trip id. Throws an Error with a user-friendly message.
 */
export async function createTripFromTemplate({ itineraryId, name, color, start, groupId }: TemplateTripInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip_from_template', {
    itinerary: itineraryId,
    trip_name: name,
    trip_color: color,
    start_day: start,
    trip_group: groupId ?? null,
  });
  if (error) {
    if (/no longer available/i.test(error.message)) throw new Error('That plan is no longer available. Pick another one.');
    if (/not in that group/i.test(error.message)) throw new Error("You're not in that group any more.");
    throw new Error("Couldn't create the trip. Check your connection and try again.");
  }
  return data as string;
}

/** Moves every plan item on the trip by `days` (negative is earlier). Organisers only. */
export async function shiftPlan(tripId: string, days: number) {
  const { error } = await supabase.rpc('shift_plan', { t: tripId, days });
  if (error) throw error;
}
