import { renderHook, act } from '@testing-library/react-native';

import { queriesFor, queueResult, rpcCalls } from '../../test-utils/supabase-mock';
import {
  coverUrl,
  createTripFromTemplate,
  destinationCards,
  filterDestinations,
  highlights,
  itemsByDay,
  lengthRange,
  shiftPlan,
  templateEnd,
  useCatalog,
  useCatalogDestination,
  useCatalogItinerary,
  type CatalogDestination,
  type CatalogItem,
} from '@/lib/catalog';

const dest = (o: Partial<CatalogDestination> = {}): CatalogDestination => ({
  id: 'goa',
  name: 'Goa',
  country: 'India',
  region: 'india',
  tags: ['beach'],
  blurb: 'Beaches.',
  cover_url: 'https://images.unsplash.com/photo-1',
  photo_credit: 'Someone',
  sort: 10,
  ...o,
});

const item = (day_index: number, start_time: string, title: string, itinerary_id = 'goa-north'): CatalogItem => ({
  id: `${itinerary_id}-${day_index}-${start_time}`,
  itinerary_id,
  day_index,
  start_time,
  title,
  note: null,
});

describe('catalog helpers', () => {
  it('sizes Unsplash covers', () => {
    expect(coverUrl('https://images.unsplash.com/photo-1', 600)).toBe('https://images.unsplash.com/photo-1?auto=format&fit=crop&w=600&q=70');
    expect(coverUrl('https://images.unsplash.com/photo-1', 600, 450)).toBe('https://images.unsplash.com/photo-1?auto=format&fit=crop&w=600&h=450&q=70');
  });

  it('filters by region or tag', () => {
    const list = [dest(), dest({ id: 'bali', region: 'abroad', tags: ['beach'] }), dest({ id: 'manali', tags: ['mountains'] })];
    expect(filterDestinations(list, 'all')).toHaveLength(3);
    expect(filterDestinations(list, 'india').map((d) => d.id)).toEqual(['goa', 'manali']);
    expect(filterDestinations(list, 'abroad').map((d) => d.id)).toEqual(['bali']);
    expect(filterDestinations(list, 'beach').map((d) => d.id)).toEqual(['goa', 'bali']);
    expect(filterDestinations(list, 'mountains').map((d) => d.id)).toEqual(['manali']);
  });

  it('describes a length range', () => {
    expect(lengthRange(3, 3)).toBe('3 nights');
    expect(lengthRange(1, 1)).toBe('1 night');
    expect(lengthRange(2, 4)).toBe('2–4 nights');
    expect(lengthRange(null, null)).toBeNull();
  });

  it('ends a trip `nights` after it starts', () => {
    expect(templateEnd('2027-01-30', 3)).toBe('2027-02-02');
  });

  it('groups items by day in time order, leaving empty days out', () => {
    const days = itemsByDay([item(2, '09:00:00', 'c'), item(0, '17:00:00', 'b'), item(0, '14:00:00', 'a')]);
    expect(days.map((d) => d.day)).toEqual([0, 2]);
    expect(days[0].items.map((i) => i.title)).toEqual(['a', 'b']);
  });

  it('picks highlights from the days between arrival and the last day', () => {
    const items = [
      item(0, '14:00:00', 'Check in'),
      item(1, '10:00:00', 'Fort Aguada'),
      item(1, '14:00:00', 'Lunch'),
      item(2, '11:00:00', 'Flea market'),
      item(3, '09:00:00', 'Water sports'),
      item(4, '10:00:00', 'Head home'),
    ];
    expect(highlights(items, 4)).toEqual(['Fort Aguada', 'Flea market', 'Water sports']);
    expect(highlights(items, 4, 2)).toEqual(['Fort Aguada', 'Flea market']);
  });

  it('counts plans and lengths per destination and drops destinations with none', () => {
    const cards = destinationCards(
      [dest({ id: 'b', name: 'B', sort: 20 }), dest({ id: 'a', name: 'A', sort: 10 }), dest({ id: 'empty', sort: 5 })],
      [
        { destination_id: 'a', nights: 4 },
        { destination_id: 'a', nights: 2 },
        { destination_id: 'b', nights: 3 },
      ],
    );
    expect(cards.map((c) => [c.id, c.plans, c.shortest, c.longest])).toEqual([
      ['a', 2, 2, 4],
      ['b', 1, 3, 3],
    ]);
  });
});

describe('createTripFromTemplate', () => {
  it('calls the RPC with every field and returns the trip id', async () => {
    queueResult('rpc:create_trip_from_template', { data: 'trip-9' });
    await expect(
      createTripFromTemplate({ itineraryId: 'goa-north', name: 'Goa trip', color: 'mint', start: '2027-01-10', groupId: 'g1' }),
    ).resolves.toBe('trip-9');
    expect(rpcCalls).toEqual([
      {
        name: 'create_trip_from_template',
        args: { itinerary: 'goa-north', trip_name: 'Goa trip', trip_color: 'mint', start_day: '2027-01-10', trip_group: 'g1' },
      },
    ]);
  });

  it('sends a null group when there is none', async () => {
    queueResult('rpc:create_trip_from_template', { data: 'trip-9' });
    await createTripFromTemplate({ itineraryId: 'goa-north', name: 'Goa trip', color: 'mint', start: '2027-01-10' });
    expect((rpcCalls[0].args as { trip_group: unknown }).trip_group).toBeNull();
  });

  it.each([
    ['That plan is no longer available', 'That plan is no longer available. Pick another one.'],
    ['You are not in that group', "You're not in that group any more."],
    ['fetch failed', "Couldn't create the trip. Check your connection and try again."],
  ])('explains "%s"', async (message, shown) => {
    queueResult('rpc:create_trip_from_template', { error: { message } });
    await expect(createTripFromTemplate({ itineraryId: 'x', name: 'x', color: 'iris', start: '2027-01-10' })).rejects.toThrow(shown);
  });
});

describe('shiftPlan', () => {
  it('moves the plan through the RPC', async () => {
    await shiftPlan('trip-1', -2);
    expect(rpcCalls).toEqual([{ name: 'shift_plan', args: { t: 'trip-1', days: -2 } }]);
  });

  it('throws when the server refuses', async () => {
    queueResult('rpc:shift_plan', { error: { message: 'Only the organiser can move the plan' } });
    await expect(shiftPlan('trip-1', 1)).rejects.toBeTruthy();
  });
});

describe('catalog hooks', () => {
  it('loads destinations with their plan counts', async () => {
    queueResult('catalog_destinations', { data: [dest()] });
    queueResult('catalog_itineraries', { data: [{ destination_id: 'goa', nights: 3 }] });
    const { result } = await renderHook(() => useCatalog());
    expect(result.current.loading).toBe(true);
    await act(() => result.current.refresh());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.destinations.map((d) => [d.id, d.plans])).toEqual([['goa', 1]]);
  });

  it('says when the catalog fails to load', async () => {
    queueResult('catalog_destinations', { error: { message: 'offline' } });
    const { result } = await renderHook(() => useCatalog());
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Couldn't load trip ideas. Check your connection and try again.");
  });

  it("loads a destination's plans with their items", async () => {
    queueResult('catalog_destinations', { data: dest() });
    queueResult('catalog_itineraries', {
      data: [
        { id: 'goa-north', destination_id: 'goa', title: 'North', summary: 's', nights: 4, pace: 'balanced', sort: 10 },
        { id: 'goa-south', destination_id: 'goa', title: 'South', summary: 's', nights: 3, pace: 'easy', sort: 20 },
      ],
    });
    queueResult('catalog_itinerary_items', { data: [item(1, '10:00:00', 'Fort', 'goa-north'), item(1, '08:00:00', 'Kayak', 'goa-south')] });
    const { result } = await renderHook(() => useCatalogDestination('goa'));
    await act(() => result.current.refresh());
    expect(result.current.destination?.name).toBe('Goa');
    expect(result.current.itineraries.map((i) => [i.id, i.items.map((x) => x.title)])).toEqual([
      ['goa-north', ['Fort']],
      ['goa-south', ['Kayak']],
    ]);
    expect(queriesFor('catalog_itinerary_items')[0].ops).toContainEqual(['in', ['itinerary_id', ['goa-north', 'goa-south']]]);
  });

  it('loads one plan with its destination', async () => {
    queueResult('catalog_itineraries', { data: { id: 'goa-north', destination_id: 'goa', title: 'North', summary: 's', nights: 4, pace: 'balanced', sort: 10 } });
    queueResult('catalog_itinerary_items', { data: [item(0, '14:00:00', 'Check in')] });
    queueResult('catalog_destinations', { data: dest() });
    const { result } = await renderHook(() => useCatalogItinerary('goa-north'));
    await act(() => result.current.refresh());
    expect(result.current.itinerary?.items).toHaveLength(1);
    expect(result.current.destination?.id).toBe('goa');
  });

  it('is empty, not loading, without an id', async () => {
    const { result } = await renderHook(() => useCatalogItinerary(undefined));
    await act(() => result.current.refresh());
    expect(result.current.loading).toBe(false);
    expect(result.current.itinerary).toBeNull();
  });
});
