import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { space } from '@/theme/tokens';

type Props = {
  count: number;
  /** This page's place, for the label. */
  step: number;
  /** Horizontal scroll of the pager, in points. */
  scrollX: SharedValue<number>;
  width: number;
  on: string;
  off: string;
};

const DOT = 8;
const PILL = 24;

function Dot({ index, scrollX, width, on, off }: { index: number; scrollX: SharedValue<number>; width: number; on: string; off: string }) {
  // Grows into a pill as its page slides in, and back as it slides out, following the finger.
  const style = useAnimatedStyle(() => {
    const t = interpolate(scrollX.value / Math.max(width, 1), [index - 1, index, index + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: DOT + (PILL - DOT) * t, backgroundColor: interpolateColor(t, [0, 1], [off, on]) };
  });
  return <Animated.View testID="intro-dot" style={[styles.dot, style]} />;
}

/** "Step n of 6": the current page's dot is a pill. */
export function PageDots({ count, step, scrollX, width, on, off }: Props) {
  return (
    <View accessible accessibilityLabel={`Step ${step + 1} of ${count}`} style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} scrollX={scrollX} width={width} on={on} off={off} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s6, height: 44 },
  dot: { height: DOT, borderRadius: DOT / 2 },
});
