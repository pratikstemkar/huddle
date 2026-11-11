import { Text as RNText, type TextProps } from 'react-native';

import { type, type TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'onColor' | 'danger';

export type AppTextProps = TextProps & { variant?: TypeVariant; tone?: Tone };

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.accent,
    onColor: colors.onColor,
    danger: colors.danger,
  }[tone];
  const isHeading = variant === 'hero' || variant === 'title' || variant === 'heading';
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={isHeading ? 1.4 : 2}
      style={[type[variant], { color }, style]}
      {...rest}
    />
  );
}
