import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon } from './icon';

export type CardProps = Omit<ViewProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** `hero` is the big coloured card at the top of a screen: no border, larger radius. */
  variant?: 'default' | 'hero';
  /** Hero fill, e.g. iris or beak. */
  color?: string;
  /** Makes the whole card one button. Give it an `accessibilityLabel`. */
  onPress?: () => void;
  accessibilityHint?: string;
  /** Lays the children out in a row and ends it with a chevron (list rows). */
  chevron?: boolean;
  children?: ReactNode;
};

export function Card({ style, variant = 'default', color, onPress, chevron, children, accessibilityLabel, accessibilityHint, ...rest }: CardProps) {
  const { colors } = useTheme();
  const hero = variant === 'hero';
  const base: StyleProp<ViewStyle> = [
    hero ? styles.hero : styles.card,
    hero ? { backgroundColor: color ?? colors.iris } : { backgroundColor: colors.card, borderColor: colors.line },
    chevron && styles.row,
  ];
  const content = (
    <>
      {children}
      {chevron ? <Icon name="chevronRight" size={20} color={colors.textSecondary} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
        {...rest}>
        {content}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} accessibilityLabel={accessibilityLabel} {...rest}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  hero: { borderRadius: radius.xl, padding: space.s20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s14 },
});
