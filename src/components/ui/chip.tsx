import { StyleSheet, type ViewStyle } from 'react-native';

import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { PressableScale } from './press-scale';
import { Text } from './text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** A filter chip. Selected chips are ink-filled. */
export function Chip({ label, selected = false, onPress, accessibilityLabel, style }: Props) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.base,
        selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : { backgroundColor: colors.card, borderColor: colors.line },
        style,
      ]}>
      <Text variant="calloutStrong" style={{ color: selected ? colors.onInk : colors.text }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
