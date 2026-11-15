import AsyncStorage from '@react-native-async-storage/async-storage';

/** Whether this device has already shown the "It's official" screen for a trip's current lock. */
export const lockedSeenKey = (tripId: string) => `huddle.lockedSeen.${tripId}`;

export async function hasSeenLocked(tripId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(lockedSeenKey(tripId))) !== null;
  } catch {
    return true;
  }
}

export async function markLockedSeen(tripId: string) {
  try {
    await AsyncStorage.setItem(lockedSeenKey(tripId), '1');
  } catch {}
}

/** After an unlock, so the next lock celebrates again. */
export async function forgetLockedSeen(tripId: string) {
  try {
    await AsyncStorage.removeItem(lockedSeenKey(tripId));
  } catch {}
}
