import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { palette, type Colors, type Scheme } from './tokens';

export function useTheme(): { scheme: Scheme; colors: Colors } {
  // Web is a single-page app (no server rendering), so the system scheme is safe to read directly.
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palette[scheme] };
}

/** True when the user asked the OS to reduce motion. Swap springs for fades when set. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
