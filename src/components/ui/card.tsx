import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md + 2, borderWidth: 1, padding: space.lg },
});
