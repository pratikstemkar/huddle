import { Pressable, StyleSheet, View } from 'react-native';

import { TRIP_COLOR_NAMES, space, tripColors, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export const COLOR_NAMES = TRIP_COLOR_NAMES;

function Swatch({ color, selected, onPress }: { color: TripColor; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={TRIP_COLOR_NAMES[color]}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.swatch, { backgroundColor: tripColors[color], borderColor: selected ? colors.ink : colors.card }]}
    />
  );
}

/** A radio group of the five trip colours. */
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s10 },
  swatch: { width: 56, height: 56, borderRadius: 28, borderWidth: 4 },
});
