import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { groupMonogram } from '@/lib/groups';
import { fonts, onTripColor, tripColors, type TripColor } from '@/theme/tokens';

/** A group's mark: its colour with the monogram on it. Decorative; label the parent. */
export function GroupTile({ name, color, size = 52 }: { name: string; color: TripColor; size?: number }) {
  const fontSize = Math.round(size * 0.38);
  return (
    <View aria-hidden style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.31), backgroundColor: tripColors[color] }]}>
      <Text maxFontSizeMultiplier={1.2} style={{ color: onTripColor[color], fontFamily: fonts.displayMedium, fontSize, lineHeight: Math.round(fontSize * 1.2) }}>
        {groupMonogram(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
