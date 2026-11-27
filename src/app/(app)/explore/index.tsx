import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DestinationCard } from '@/components/explore/destination-card';
import { goBack } from '@/components/explore/go-back';
import { Pip } from '@/components/pip/pip';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CATALOG_FILTERS, filterDestinations, useCatalog, type CatalogFilter } from '@/lib/catalog';
import { space } from '@/theme/tokens';

/** Pairs for the two-column grid; an odd last card sits alone at half width. */
function rows<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

export default function Explore() {
  // Started from a group: the trip will be linked to it, so carry it through every step.
  const params = useLocalSearchParams<{ group?: string }>();
  const group = typeof params.group === 'string' && params.group ? params.group : undefined;
  const { destinations, loading, error, refresh } = useCatalog();
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const shown = useMemo(() => filterDestinations(destinations, filter), [destinations, filter]);

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.header}>
          <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
        </View>

        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text variant="title">Where should we go?</Text>
            <Text variant="callout" tone="secondary">
              Pick a place and a ready-made plan. You can change any of it later.
            </Text>
          </View>
          <Pip mood="idle" size={72} tilt={-4} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {CATALOG_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>

        {loading && destinations.length === 0 ? (
          <Loading label="Finding places" />
        ) : error && destinations.length === 0 ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : shown.length === 0 ? (
          <Text variant="callout" tone="secondary" style={styles.empty}>
            Nothing here yet. Try another filter.
          </Text>
        ) : (
          <View style={styles.grid}>
            {rows(shown).map((pair) => (
              <View key={pair[0].id} style={styles.row}>
                {pair.map((d) => (
                  <DestinationCard
                    key={d.id}
                    destination={d}
                    style={styles.cell}
                    onPress={() => router.push({ pathname: '/explore/[destination]', params: { destination: d.id, ...(group ? { group } : {}) } })}
                  />
                ))}
                {pair.length === 1 ? <View style={styles.cell} /> : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s18 },
  header: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  chips: { gap: space.sm, paddingRight: space.screenX },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1 },
  empty: { textAlign: 'center', paddingVertical: space.xl },
});
