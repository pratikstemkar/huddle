import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, navClearance, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  children: ReactNode;
  /** Pinned to the bottom, within thumb reach. Use for the one primary action. */
  footer?: ReactNode;
  scroll?: boolean;
  /** A tab screen: keeps the content clear of the floating tab bar. */
  withNav?: boolean;
  contentStyle?: ViewStyle;
};

/** Page wrapper: theme background, safe areas, and a centred phone-width column on web. */
export function Screen({ children, footer, scroll = true, withNav = false, contentStyle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = withNav ? navClearance(insets) : 0;
  const body = <View style={[styles.content, withNav && !footer && { paddingBottom: clearance }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={withNav ? ['top'] : ['top', 'bottom']}>
      <View style={styles.column}>
        {scroll ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <View style={[styles.footer, withNav && { paddingBottom: clearance }]}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: space.screenX, paddingTop: space.md, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.screenX, paddingBottom: space.lg, paddingTop: space.sm },
});
