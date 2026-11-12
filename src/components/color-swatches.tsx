import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { MIN_TOUCH, radius, space, springs, tripColors, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export const COLOR_NAMES: Record<TripColor, string> = {
  sunset: 'Sunset',
  lagoon: 'Lagoon',
  mango: 'Mango',
  plum: 'Plum',
  bougainvillea: 'Bougainvillea',
  sky: 'Sky',
};

function Swatch({ color, selected, onPress }: { color: TripColor; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? 1 : 0.82, springs.bouncy) }],
  }));
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={COLOR_NAMES[color]}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.swatchHit, { borderColor: selected ? colors.text : 'transparent' }]}>
      <Animated.View style={[styles.swatch, { backgroundColor: tripColors[color] }, ring]} />
    </Pressable>
  );
}

/** A radio group of the six palette colours. */
export function ColorSwatches({ value, onChange }: { value: TripColor | null; onChange: (c: TripColor) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.swatches}>
      {(Object.keys(tripColors) as TripColor[]).map((c) => (
        <Swatch key={c} color={c} selected={c === value} onPress={() => onChange(c)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatchHit: { width: MIN_TOUCH + 4, height: MIN_TOUCH + 4, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 40, height: 40, borderRadius: 20 },
});
