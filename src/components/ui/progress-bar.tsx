import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** 0 to 1. */
  value: number;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function ProgressBar({ value, accessibilityLabel, style }: Props) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors.tint.vote }, style]}>
      <View testID="progress-fill" style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: colors.iris }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.xs },
});
