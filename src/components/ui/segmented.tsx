import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { radius, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { PressableScale } from './press-scale';
import { Text } from './text';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  /** `sm` is the quieter second-level switch: outlined, tinted selection, shorter. */
  size?: 'md' | 'sm';
};

const PAD = 4;

export function Segmented<T extends string>({ options, value, onChange, style, size = 'md' }: Props<T>) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const small = size === 'sm';
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;

  useEffect(() => {
    if (slot === 0) return;
    const target = PAD + index * slot;
    // The first measurement jumps; later changes glide, and a quick second tap reverses from where it is.
    if (reduced || x.get() === 0) x.set(target);
    else x.set(withTiming(target, { duration: 200, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [index, slot, reduced, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.wrap, small ? [styles.small, { borderColor: colors.line }] : { backgroundColor: colors.track }, style]}>
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.indicator, small && styles.indicatorSmall, { width: slot, backgroundColor: small ? colors.tint.vote : colors.card }, indicator]} />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            pressedScale={0.97}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            aria-selected={on}
            onPress={() => onChange(o.value)}
            // Before the first measurement there is no sliding pill, so the selected item paints its own.
            style={[styles.item, small && styles.itemSmall, slot === 0 && on && { backgroundColor: small ? colors.tint.vote : colors.card }]}>
            <Text variant={small ? 'caption' : 'calloutStrong'} tone={on ? (small ? 'iris' : 'primary') : 'secondary'} style={small ? styles.smallText : undefined}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', height: 48, borderRadius: radius.card, padding: PAD },
  small: { height: 40, borderRadius: radius.lg, borderWidth: 1 },
  indicatorSmall: { borderRadius: radius.md },
  itemSmall: { borderRadius: radius.md },
  smallText: { fontWeight: '600' },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: radius.lg },
  item: { flex: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
