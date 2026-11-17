import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import type { Scheme } from './tokens';

/** What the person picked in the You screen. `system` follows the phone. */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'huddle.theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export async function saveThemePreference(preference: ThemePreference) {
  try {
    await AsyncStorage.setItem(KEY, preference);
  } catch {
    // Storage can be unavailable (private browsing); the choice still applies until the app closes.
  }
}

/** Native controls (Switch, alerts, keyboard) read the app-level scheme, so keep it in step. Web has no override. */
function applyNativeScheme(preference: ThemePreference) {
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** False until the saved choice has been read, so the first frame isn't in the wrong theme. */
  loaded: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  preference: 'system',
  setPreference: () => {},
  loaded: true,
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    loadThemePreference().then((stored) => {
      if (!live) return;
      applyNativeScheme(stored);
      setState(stored);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    applyNativeScheme(next);
    setState(next);
    saveThemePreference(next);
  }, []);

  const value = useMemo(() => ({ preference, setPreference, loaded }), [preference, setPreference, loaded]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
