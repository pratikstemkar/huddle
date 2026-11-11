import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  children: ReactNode;
  /** Pinned to the bottom, within thumb reach. Use for the one primary action. */
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/** Page wrapper: theme background, safe areas, and a centred phone-width column on web. */
export function Screen({ children, footer, scroll = true, contentStyle }: Props) {
  const { colors } = useTheme();
  const body = <View style={[styles.content, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.column}>
        {scroll ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, paddingTop: space.sm },
});
