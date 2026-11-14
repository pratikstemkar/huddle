import { Text as RNText, type TextProps } from 'react-native';

import { type, type Colors, type TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type Tone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'iris'
  | 'accent'
  | 'positive'
  | 'owe'
  | 'danger'
  | 'onIris'
  | 'onBeak'
  | 'onInk'
  | 'onColor';

export type AppTextProps = TextProps & { variant?: TypeVariant; tone?: Tone };

const HEADERS: ReadonlySet<TypeVariant> = new Set(['hero', 'display', 'title', 'titleSm', 'heading']);

export function toneColor(colors: Colors, tone: Tone) {
  return {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    iris: colors.irisText,
    accent: colors.irisText,
    positive: colors.positive,
    owe: colors.owe,
    danger: colors.danger,
    onIris: colors.onIris,
    onBeak: colors.onBeak,
    onInk: colors.onInk,
    onColor: colors.onColor,
  }[tone];
}

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const isHeading = HEADERS.has(variant);
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={isHeading ? 1.4 : 2}
      style={[type[variant], { color: toneColor(colors, tone) }, style]}
      {...rest}
    />
  );
}
