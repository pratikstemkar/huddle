import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { onTripColor, radius, space, springs, tripColors, type Colors, type TripColor } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type ButtonVariant = 'primary' | 'ink' | 'outline' | 'outlineInk' | 'beak' | 'suggest' | 'ghost' | 'secondary' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon: an icon name from the Huddle set, or any element. */
  icon?: IconName | ReactNode;
  iconRight?: IconName | ReactNode;
  loading?: boolean;
  /** Can't be pressed: dimmed, no haptic, announced as disabled. */
  disabled?: boolean;
  /** Override the fill, e.g. a trip colour. The text picks a readable colour for it. */
  color?: string;
  /** Suggest variant only: the tall tile with the icon stacked over the label (Photos). */
  tall?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  /** Defaults to the label; set it when several buttons share a label (e.g. "Remove"). */
  accessibilityLabel?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZES: Record<ButtonSize, { height: number; radius: number; paddingX: number; text: 'bodyStrong' | 'label' | 'calloutStrong' }> = {
  lg: { height: 56, radius: 28, paddingX: space.xl, text: 'bodyStrong' },
  md: { height: 52, radius: 26, paddingX: space.xl, text: 'label' },
  sm: { height: 44, radius: 22, paddingX: space.s18, text: 'calloutStrong' },
};

/** Text that reads on a custom fill: the trip colour's own pairing, else the ink used on light fills. */
function textOn(fill: string, colors: Colors) {
  const key = (Object.keys(tripColors) as TripColor[]).find((k) => tripColors[k].toLowerCase() === fill.toLowerCase());
  return key ? onTripColor[key] : colors.onBeak;
}

function look(variant: ButtonVariant, colors: Colors, color?: string): { bg: string; fg: string; border?: ViewStyle } {
  switch (variant) {
    case 'primary':
      return color ? { bg: color, fg: textOn(color, colors) } : { bg: colors.iris, fg: colors.onIris };
    case 'ink':
      return { bg: colors.ink, fg: colors.onInk };
    case 'outline':
    case 'secondary':
      return { bg: colors.card, fg: colors.text, border: { borderWidth: 1, borderColor: colors.lineStrong } };
    case 'outlineInk':
      return { bg: 'transparent', fg: colors.text, border: { borderWidth: 2, borderColor: colors.ink } };
    case 'beak':
      return { bg: colors.beak, fg: colors.onBeak };
    case 'suggest':
      return { bg: 'transparent', fg: colors.irisText, border: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.dashed } };
    case 'ghost':
      return { bg: 'transparent', fg: colors.text };
    case 'danger':
      return { bg: colors.danger, fg: colors.onIris };
  }
}

function renderIcon(icon: IconName | ReactNode, color: string, size: number) {
  return typeof icon === 'string' ? <Icon name={icon as IconName} color={color} size={size} /> : icon;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size,
  icon,
  iconRight,
  loading,
  disabled,
  color,
  tall,
  style,
  accessibilityHint,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = (to: number) => {
    scale.set(reduced ? withTiming(to, { duration: 80 }) : withSpring(to, springs.press));
  };

  const s = SIZES[size ?? (variant === 'beak' ? 'sm' : 'lg')];
  const { bg, fg, border } = look(variant, colors, color);
  const suggest = variant === 'suggest';
  const leading = icon ?? (suggest ? 'plus' : undefined);
  const shape: ViewStyle = suggest
    ? tall
      ? { minHeight: 110, borderRadius: 22, paddingHorizontal: space.lg }
      : { minHeight: 52, borderRadius: radius.card, paddingHorizontal: space.xl }
    : { minHeight: s.height, borderRadius: s.radius, paddingHorizontal: s.paddingX };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading, ...(disabled ? { disabled: true } : null) }}
      disabled={disabled}
      onPressIn={() => !disabled && press(0.96)}
      onPressOut={() => press(1)}
      onPress={() => {
        if (loading || disabled) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[styles.base, shape, { backgroundColor: bg }, border, disabled && styles.disabled, animated, style]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={[styles.row, suggest && tall && styles.stack]}>
          {leading ? renderIcon(leading, fg, suggest && tall ? 26 : 20) : null}
          <Text variant={suggest ? 'label' : s.text} style={{ color: fg }}>
            {label}
          </Text>
          {iconRight ? renderIcon(iconRight, fg, 20) : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  disabled: { opacity: 0.5 },
  stack: { flexDirection: 'column', gap: space.s6 },
});
