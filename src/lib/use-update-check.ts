import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/** A check that completed stands for this long before another is worth making. */
const CHECK_INTERVAL_MS = 30 * 60_000;

/**
 * Looks for a new over-the-air update whenever the app returns to the foreground.
 *
 * expo-updates only checks at launch, and Android keeps an app in memory for days, so an update
 * published this morning could sit unseen. A downloaded update is applied by the next cold start;
 * this never restarts the app under the user. Native-only and a no-op in development builds, where
 * `Updates.isEnabled` is false. Every failure is dropped: the launch check still runs.
 */
export function useUpdateCheck() {
  const lastCheck = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web' || !Updates.isEnabled) return;

    // The native side has just made the launch check; a second one now would ask the same question.
    lastCheck.current = Date.now();

    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the server is unreachable. Nothing here is load-bearing.
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, []);
}
