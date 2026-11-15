import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { space, speechRadius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './text';

type Props = {
  children: ReactNode;
  lead?: string;
  /** One small action on the right, usually `<Button size="sm" />`. */
  action?: ReactNode;
  style?: ViewStyle;
};

/** "Pip says": what the group should do next. One per screen at most. */
export function SpeechCard({ children, lead = 'Pip says', action, style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, speechRadius, { backgroundColor: colors.tint.vote }, style]}>
      <Text variant="callout" style={styles.text}>
        <Text variant="calloutStrong" tone="iris">
          {lead}
        </Text>{' '}
        {children}
      </Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.s14, paddingHorizontal: space.lg },
  text: { flex: 1 },
});
