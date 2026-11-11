import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { MIN_TOUCH, radius, space, springs } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  /** Override fill, e.g. a trip colour. Text stays near-black for contrast. */
  color?: string;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', icon, loading, color, style, accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = (to: number) => {
    scale.set(reduced ? withTiming(to, { duration: 80 }) : withSpring(to, springs.press));
  };

  const bg = variant === 'primary' ? (color ?? colors.accent) : variant === 'secondary' ? colors.card : 'transparent';
  const fg = variant === 'primary' ? colors.onColor : colors.text;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading }}
      onPressIn={() => press(0.96)}
      onPressOut={() => press(1)}
      onPress={() => {
        if (loading) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        styles.base,
        { backgroundColor: bg },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.line },
        animated,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="label" style={{ color: fg }}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
