import { StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

/** Pip thinking while a panel's data loads. */
export function PanelLoading({ label }: { label: string }) {
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Pip mood="hmm" size={96} />
      <Text variant="callout" tone="secondary">
        {label}…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl },
});
