import type { Session } from '@supabase/supabase-js';

import type { Destination } from '@/lib/destinations';
import type { TripDetail, TripMember } from '@/lib/trips';

export const ORGANISER = 'org-id';
export const MEMBER = 'member-id';
export const TRIP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

export const members: TripMember[] = [
  { user_id: ORGANISER, role: 'organiser', display_name: 'Aarav', avatar_url: null, avatar_color: null },
  { user_id: MEMBER, role: 'member', display_name: 'Meera', avatar_url: null, avatar_color: 'plum' },
];

export function destination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'd1',
    title: 'Palolem Beach',
    note: null,
    url: null,
    image_url: null,
    created_by: ORGANISER,
    created_at: '2027-01-01T00:00:00Z',
    voteCount: 0,
    voters: [],
    iVoted: false,
    ...overrides,
  };
}

export function trip(overrides: Partial<TripDetail> = {}): TripDetail {
  return {
    id: TRIP_ID,
    name: 'Goa in March',
    color: 'sunset',
    status: 'planning',
    invite_code: 'goa2027',
    created_at: '2027-01-01T00:00:00Z',
    created_by: ORGANISER,
    locked_start: null,
    locked_end: null,
    locked_destination_id: null,
    show_who_marked: true,
    members,
    destinations: [],
    availabilityCount: 0,
    bestDays: [],
    ...overrides,
  };
}

export function sessionFor(userId: string, name = 'Aarav Shah') {
  return { user: { id: userId, email: 'aarav@dev.test', user_metadata: { full_name: name } } } as unknown as Session;
}

/** What `useTrip` returns, with a jest mock for `refresh`. */
export function tripState(t: TripDetail | null, extra: Partial<{ loading: boolean; error: string | null }> = {}) {
  return { trip: t, loading: false, error: null, refresh: jest.fn(), ...extra };
}
