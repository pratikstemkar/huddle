import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';

/** Back to the trips list, for the trip tabs that otherwise leave you with nowhere to go but the Trip tab. */
export function TripBack() {
  return (
    <View style={styles.row}>
      <IconButton
        icon="back"
        accessibilityLabel="Back to your trips"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
});
