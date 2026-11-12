import AsyncStorage from '@react-native-async-storage/async-storage';

// An invite code opened while signed out, kept until sign-in finishes.
// Stored (not just held in memory) because web Google sign-in leaves the page and comes back.
const KEY = 'huddle.pendingInvite';

export async function savePendingInvite(code: string) {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    // Storage can be unavailable (private browsing); the visitor can still paste the code after sign-in.
  }
}

/** Returns the saved code, if any, and forgets it so it is used once. */
export async function takePendingInvite(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(KEY);
    if (code) await AsyncStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
