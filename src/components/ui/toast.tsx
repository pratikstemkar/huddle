import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MAX_CONTENT_WIDTH, radius, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const SHOW_MS = 2400;

type Toast = { id: number; message: string };
type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

/** `const toast = useToast(); toast.show('Link copied')`. One at a time; a new one replaces the old. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const next = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((message: string) => {
    clearTimeout(timer.current);
    next.current += 1;
    setToast({ id: next.current, message });
    timer.current = setTimeout(() => setToast(null), SHOW_MS);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={[styles.dock, { top: insets.top + space.sm }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={reduced ? undefined : FadeInUp.duration(200).easing(Easing.bezier(0.23, 1, 0.32, 1))}
            exiting={reduced ? undefined : FadeOut.duration(150)}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: colors.ink }]}>
            <Icon name="check" size={16} color={colors.onInk} strokeWidth={2.4} />
            <Text variant="calloutStrong" tone="onInk" style={styles.text}>
              {toast.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.screenX },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: MAX_CONTENT_WIDTH,
    paddingVertical: space.s10,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  text: { flexShrink: 1 },
});
