import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

/** Leaves a sheet: back when there's somewhere to go, else the trip's Split tab. */
export function closeSheet(tripId: string | undefined) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/trip/[id]/split', params: { id: tripId ?? '' } });
}

/** A sheet's title with a close button. */
export function SheetHeader({ title, tripId }: { title: string; tripId: string | undefined }) {
  return (
    <View style={styles.row}>
      <Text variant="titleSm" style={styles.title}>
        {title}
      </Text>
      <IconButton icon="close" accessibilityLabel="Close" onPress={() => closeSheet(tripId)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1 },
});
