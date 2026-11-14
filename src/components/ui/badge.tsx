import { StyleSheet, View, type ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

export type BadgeTone = 'vote' | 'beak' | 'neutral' | 'beakSm';

type Props = { label: string; tone?: BadgeTone; style?: ViewStyle };

/** A small status label, e.g. "Planning days" or "Your vote needed". */
export function Badge({ label, tone = 'vote', style }: Props) {
  const { colors } = useTheme();
  const look = {
    vote: { bg: colors.tint.vote, fg: colors.irisText },
    beak: { bg: colors.beak, fg: colors.onBeak },
    beakSm: { bg: colors.beak, fg: colors.onBeak },
    neutral: { bg: colors.bg, fg: colors.textSecondary },
  }[tone];
  return (
    <View style={[tone === 'beakSm' ? styles.small : styles.base, { backgroundColor: look.bg }, style]}>
      <Text variant="badge" style={{ color: look.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.badge },
  small: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.badgeSm },
});
