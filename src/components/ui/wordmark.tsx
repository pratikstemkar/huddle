import { Text as RNText, type TextStyle } from 'react-native';

import { wordmarkStyle } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  size?: number;
  /** Ink follows the scheme's text colour; white is for iris or ink grounds. */
  tone?: 'ink' | 'white';
  style?: TextStyle;
};

/** The "huddle" wordmark: Bricolage 800, always lower case. */
export function Wordmark({ size = 48, tone = 'ink', style }: Props) {
  const { colors } = useTheme();
  return (
    <RNText
      accessibilityRole="header"
      accessibilityLabel="Huddle"
      maxFontSizeMultiplier={1.2}
      style={[wordmarkStyle(size), { color: tone === 'white' ? '#FFFFFF' : colors.text }, style]}>
      huddle
    </RNText>
  );
}
