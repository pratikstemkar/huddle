import { StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/use-theme';
import { Avatar } from './avatar';

export type StackPerson = { name: string; url?: string | null; color?: string | null };

type Props = {
  people: StackPerson[];
  size?: number;
  overlap?: number;
  /** Colour of the surface behind the stack; defaults to the screen background. */
  ring?: string;
  /** Show at most this many, then a "+N" chip. */
  max?: number;
  style?: ViewStyle;
};

/** Overlapping avatars. Decorative: the parent sets the accessibility label (e.g. "5 people"). */
export function AvatarStack({ people, size = 34, overlap = 8, ring, max, style }: Props) {
  const { colors } = useTheme();
  const ringColor = ring ?? colors.bg;
  const shown = max != null && people.length > max ? people.slice(0, max) : people;
  const extra = people.length - shown.length;
  return (
    <View style={[styles.row, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} url={p.url} color={p.color} size={size} ring={ringColor} style={i > 0 ? { marginLeft: -overlap } : undefined} />
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            { width: size, height: size, borderRadius: size / 2, marginLeft: shown.length ? -overlap : 0, backgroundColor: colors.track, borderColor: ringColor },
          ]}>
          <RNText maxFontSizeMultiplier={1.2} style={{ color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
            +{extra}
          </RNText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  more: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
