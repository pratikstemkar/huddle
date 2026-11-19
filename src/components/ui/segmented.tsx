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
};

const PAD = 4;

export function Segmented<T extends string>({ options, value, onChange, style }: Props<T>) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
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
      style={[styles.wrap, { backgroundColor: colors.track }, style]}>
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.indicator, { width: slot, backgroundColor: colors.card }, indicator]} />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            pressedScale={0.97}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            // Before the first measurement there is no sliding pill, so the selected item paints its own.
            style={[styles.item, slot === 0 && on && { backgroundColor: colors.card }]}>
            <Text variant="calloutStrong" tone={on ? 'primary' : 'secondary'}>
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
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: radius.lg },
  item: { flex: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
