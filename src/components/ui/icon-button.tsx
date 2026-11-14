import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { MIN_TOUCH } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon, type IconName } from './icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  /** `card` for back and close, `iris` for the one add action (e.g. invite people). */
  variant?: 'card' | 'iris';
  accessibilityHint?: string;
  style?: ViewStyle;
};

/** A 44pt round icon control. */
export function IconButton({ icon, accessibilityLabel, onPress, variant = 'card', accessibilityHint, style }: Props) {
  const { colors } = useTheme();
  const iris = variant === 'iris';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        iris ? { backgroundColor: pressed ? colors.irisPressed : colors.iris } : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
        pressed && !iris && { opacity: 0.7 },
        style,
      ]}>
      <Icon name={icon} size={iris ? 20 : 22} color={iris ? colors.onIris : colors.text} strokeWidth={iris && icon === 'plus' ? 2.4 : undefined} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
