import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { NAV_HEIGHT, springs } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const SHOW_MS = 4000;

type Props = {
  /** What the Pip button does, e.g. "New trip". */
  label: string;
  /** Change it to pop the bubble up again (a new tab, a new screen). */
  replayKey?: string;
};

/** A speech bubble above the Pip button: pops in, stays a few seconds, then fades. */
export function PipHint({ label, replayKey }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      shown.set(withSequence(withTiming(1, { duration: 150 }), withDelay(SHOW_MS, withTiming(0, { duration: 250 }))));
      return;
    }
    shown.set(withSequence(withSpring(1, springs.bouncy), withDelay(SHOW_MS, withTiming(0, { duration: 250 }))));
  }, [label, replayKey, reduced, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get()),
    transform: [{ translateY: (1 - shown.get()) * 8 }, { scale: 0.9 + 0.1 * shown.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="pip-hint"
      style={[styles.bubble, { backgroundColor: colors.beak }, style]}>
      <Text variant="label" tone="onBeak" numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: 0,
    bottom: NAV_HEIGHT + 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
    transformOrigin: 'bottom right',
  },
});
