import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { NAV_HEIGHT } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

const SHOW_MS = 4000;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** The bubble pops up once per launch: after that it would only repeat what the tab bar already says. */
let played = false;

/** One of these, at random, each time the bubble pops up; never the same line twice in a row. */
function pickLine(lines: readonly string[], not?: string) {
  const options = lines.length > 1 ? lines.filter((l) => l !== not) : lines;
  return options[Math.floor(Math.random() * options.length)];
}

type Props = {
  /** Lines Pip may say; each should make clear what the button does, e.g. "New trip". */
  labels: readonly string[];
  /** Change it to pop the bubble up again (a new tab, a new screen). */
  replayKey?: string;
};

/** A speech bubble above the Pip button: pops in, stays a few seconds, then fades. */
export function PipHint({ labels, replayKey }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  const [{ key, label }, setLine] = useState(() => ({ key: replayKey, label: pickLine(labels) }));
  // A new key (tab change) means a new line.
  if (key !== replayKey) setLine({ key: replayKey, label: pickLine(labels, label) });

  useEffect(() => {
    if (played) return;
    played = true;
    shown.set(withSequence(withTiming(1, { duration: reduced ? 150 : 200, easing: EASE_OUT }), withDelay(SHOW_MS, withTiming(0, { duration: 250 }))));
  }, [shown, reduced]);

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
