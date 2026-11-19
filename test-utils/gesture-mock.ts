import type { ReactNode } from 'react';

/**
 * Gesture Handler needs a native root view, so tests swap the pan hook for one that records its config.
 * `pan.config` holds the callbacks of the latest render; a test calls them the way the recogniser would.
 */
export const pan: { config: null | Record<string, (e?: unknown) => void> & { enabled?: boolean; activateAfterLongPress?: number } } = { config: null };

export const gestureHandler = {
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
  GestureDetector: ({ children }: { children: ReactNode }) => children,
  usePanGesture: (config: NonNullable<typeof pan.config>) => {
    pan.config = config;
    return {};
  },
};
