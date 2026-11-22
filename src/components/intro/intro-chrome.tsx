import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Hides what's off screen from screen readers and touches, so only the visible chrome is read out or pressed. */
export function chromeA11y(shown: boolean) {
  return {
    'aria-hidden': !shown,
    accessibilityElementsHidden: !shown,
    importantForAccessibility: shown ? ('auto' as const) : ('no-hide-descendants' as const),
    pointerEvents: shown ? ('box-none' as const) : ('none' as const),
  };
}

/**
 * Stays in place while the pages slide, and fades in as the pager reaches page `from` and out as it
 * leaves page `to`, following the scroll so it never pops.
 */
export function ChromeFade({
  from,
  to,
  scrollX,
  width,
  index,
  style,
  children,
}: {
  from: number;
  to: number;
  scrollX: SharedValue<number>;
  width: number;
  /** The current page, for what's pressable and readable. */
  index: number;
  style?: object;
  children: ReactNode;
}) {
  const anim = useAnimatedStyle(() => {
    const at = scrollX.value / Math.max(width, 1);
    const opacity =
      to > from
        ? interpolate(at, [from - 1, from, to, to + 1], [0, 1, 1, 0], Extrapolation.CLAMP)
        : interpolate(at, [from - 1, from, from + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity };
  });
  const shown = index >= from && index <= to;
  return (
    <Animated.View {...chromeA11y(shown)} style={[styles.layer, style, anim]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { left: 0, right: 0 },
});
