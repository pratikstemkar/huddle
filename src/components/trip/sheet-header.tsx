import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

/** A sheet's top row: the close button and the 28/32 title. */
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.row}>
      <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
      <Text variant="titleSm" style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1 },
});
