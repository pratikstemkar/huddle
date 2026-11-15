import { Image } from 'expo-image';
import { StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native';

import { toTripColor, tripTints } from '@/theme/tokens';

const INK = '#171A2F';

type Props = {
  name: string;
  /** A photo (from Google/Apple); shown instead of the initial when set. */
  url?: string | null;
  /** The person's chosen colour key. Older keys still map to a current colour. */
  color?: string | null;
  /** Background when the person hasn't picked a colour, e.g. a trip tint. */
  fallbackColor?: string;
  size?: number;
  /** A 2px ring in the colour of the surface behind, so stacked avatars read apart. */
  ring?: string;
  style?: ViewStyle;
};

function initialSize(size: number) {
  if (size <= 34) return 13;
  if (size <= 40) return 15;
  if (size <= 48) return 16;
  return Math.round(size * 0.4);
}

/** A round avatar: the person's photo, or their ink initial on their colour's tint. Decorative; label the parent. */
export function Avatar({ name, url, color, fallbackColor = tripTints.iris, size = 34, ring, style }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[box, ringStyle, style] as never}
        contentFit="cover"
        aria-hidden
      />
    );
  }
  const bg = color ? tripTints[toTripColor(color)] : fallbackColor;
  const fontSize = initialSize(size);
  return (
    <View
      style={[styles.initial, box, { backgroundColor: bg }, ringStyle, style]}
      aria-hidden>
      <RNText maxFontSizeMultiplier={1.2} style={{ color: INK, fontWeight: '600', fontSize, lineHeight: Math.round(fontSize * 1.25) }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
});
