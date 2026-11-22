import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Set once the first-open intro has been seen or skipped, or once anyone signs in on this device.
const KEY = 'huddle.introSeen';
// "I have an invite code" on the intro: open the join screen once sign-in finishes.
const JOIN_KEY = 'huddle.joinAfterSignIn';

export async function loadIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Storage can be unavailable (private browsing); showing the intro again is the safe fallback.
    return false;
  }
}

async function saveIntroSeen() {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Still marked seen in memory for this session.
  }
}

export async function saveJoinAfterSignIn() {
  try {
    await AsyncStorage.setItem(JOIN_KEY, '1');
  } catch {
    // They can still open Join from the Groups tab.
  }
}

/** True once if the intro asked for the join screen after sign-in; forgets it so it is used once. */
export async function takeJoinAfterSignIn(): Promise<boolean> {
  try {
    const wanted = (await AsyncStorage.getItem(JOIN_KEY)) === '1';
    if (wanted) await AsyncStorage.removeItem(JOIN_KEY);
    return wanted;
  } catch {
    return false;
  }
}

type IntroSeenValue = {
  seen: boolean;
  /** False until the saved flag has been read, so the first screen is the right one. */
  loaded: boolean;
  markSeen: () => void;
};

const IntroSeenContext = createContext<IntroSeenValue>({ seen: true, loaded: true, markSeen: () => {} });

export function IntroSeenProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    loadIntroSeen().then((stored) => {
      if (!live) return;
      setSeen((now) => now || stored);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const markSeen = useCallback(() => {
    setSeen(true);
    saveIntroSeen();
  }, []);

  const value = useMemo(() => ({ seen, loaded, markSeen }), [seen, loaded, markSeen]);
  return <IntroSeenContext.Provider value={value}>{children}</IntroSeenContext.Provider>;
}

export function useIntroSeen() {
  return useContext(IntroSeenContext);
}
