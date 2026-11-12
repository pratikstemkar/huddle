import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { tripColors, type TripColor } from '@/theme/tokens';
import { Text } from './text';

type Props = {
  name: string;
  /** A photo (from Google/Apple); shown instead of the initial when set. */
  url?: string | null;
  /** The person's chosen colour for their initial. */
  color?: TripColor | null;
  /** Used when the person hasn't picked a colour, e.g. the trip colour. */
  fallbackColor?: string;
  size?: number;
  style?: ViewStyle;
};

/** A round avatar: the person's photo, or their initial on their colour. Decorative; label the parent. */
export function Avatar({ name, url, color, fallbackColor = tripColors.sunset, size = 32, style }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return <Image source={{ uri: url }} style={[box, style as object]} contentFit="cover" accessibilityElementsHidden importantForAccessibility="no" />;
  }
  const bg = color ? tripColors[color] : fallbackColor;
  return (
    <View style={[styles.initial, box, { backgroundColor: bg }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text variant={size >= 44 ? 'heading' : 'label'} tone="onColor" style={size >= 72 ? { fontSize: size * 0.42, lineHeight: size * 0.5 } : undefined}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
});
