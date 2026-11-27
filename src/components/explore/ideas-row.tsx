import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/lib/catalog';
import { space } from '@/theme/tokens';
import { DestinationCard } from './destination-card';

const SHOWN = 6;

/** "Ideas for your next trip" on Home: a few destinations to scroll through, and a way into Explore. Hidden until it loads. */
export function IdeasRow() {
  const { destinations, refresh } = useCatalog();
  // The catalog barely changes: load it once, not on every visit to Home.
  const empty = destinations.length === 0;
  useFocusEffect(
    useCallback(() => {
      if (empty) refresh();
    }, [empty, refresh]),
  );
  if (destinations.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          Ideas for your next trip
        </Text>
        <Button label="See all" variant="ghost" size="sm" accessibilityHint="Opens ready-made trips" onPress={() => router.push('/explore')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {destinations.slice(0, SHOWN).map((d) => (
          <DestinationCard
            key={d.id}
            destination={d}
            size="compact"
            onPress={() => router.push({ pathname: '/explore/[destination]', params: { destination: d.id } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  row: { gap: space.md, paddingRight: space.screenX },
});
