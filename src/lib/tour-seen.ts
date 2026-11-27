import AsyncStorage from '@react-native-async-storage/async-storage';

/** The guided tours: one over the home tabs, one the first time a trip is opened. */
export type TourId = 'home' | 'trip';
export const TOUR_IDS: readonly TourId[] = ['home', 'trip'];

export const tourSeenKey = (id: TourId) => `huddle.tour.${id}`;

export type ToursSeen = Record<TourId, boolean>;

export async function loadToursSeen(): Promise<ToursSeen> {
  try {
    const rows = await AsyncStorage.multiGet(TOUR_IDS.map(tourSeenKey));
    const seen = new Set(rows.filter(([, v]) => v === '1').map(([k]) => k));
    return { home: seen.has(tourSeenKey('home')), trip: seen.has(tourSeenKey('trip')) };
  } catch {
    // Storage can be unavailable (private browsing). Not showing a tour beats showing it on every launch.
    return { home: true, trip: true };
  }
}

export async function saveTourSeen(id: TourId) {
  try {
    await AsyncStorage.setItem(tourSeenKey(id), '1');
  } catch {
    // Still marked seen in memory for this session.
  }
}

/** "Show me around again" on the You tab: both tours play again. */
export async function forgetToursSeen() {
  try {
    await AsyncStorage.multiRemove(TOUR_IDS.map(tourSeenKey));
  } catch {}
}
