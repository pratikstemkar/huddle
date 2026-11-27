import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ItineraryDays } from '@/components/explore/itinerary-days';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { goBack } from '@/components/explore/go-back';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { posthog } from '@/config/posthog';
import { daysLabel, nightsLabel, PACE_LABEL, useCatalogItinerary } from '@/lib/catalog';
import { space } from '@/theme/tokens';

export default function ExplorePlan() {
  const params = useLocalSearchParams<{ id: string; group?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const group = typeof params.group === 'string' && params.group ? params.group : undefined;
  const { itinerary, destination, loading, error, refresh } = useCatalogItinerary(id);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const use = () => {
    if (!itinerary) return;
    posthog?.capture('template_selected', { template_id: itinerary.id, destination_id: itinerary.destination_id, nights: itinerary.nights });
    router.push({ pathname: '/new-trip', params: { template: itinerary.id, ...(group ? { group } : {}) } });
  };

  let body;
  if (loading && !itinerary) body = <Loading label="Loading the plan" />;
  else if (error && !itinerary) body = <ErrorState message={error} onRetry={refresh} />;
  else if (!itinerary)
    body = <ErrorState title="Not found" message="That plan isn't available any more. Pick another one." />;
  else
    body = (
      <>
        <View style={styles.intro}>
          {destination ? (
            <Text variant="calloutStrong" tone="iris">
              {destination.name}, {destination.country}
            </Text>
          ) : null}
          <Text variant="title">{itinerary.title}</Text>
          <Text variant="callout" tone="secondary">
            {itinerary.summary}
          </Text>
          <View style={styles.badges}>
            <Badge label={`${nightsLabel(itinerary.nights)}, ${daysLabel(itinerary.nights)}`} />
            <Badge label={PACE_LABEL[itinerary.pace]} tone="neutral" />
          </View>
        </View>
        <ItineraryDays items={itinerary.items} />
        <Text variant="caption" tone="secondary">
          Everyone on the trip can add to the plan, and you can edit or remove any of it later.
        </Text>
      </>
    );

  return (
    <Screen footer={itinerary ? <Button label="Use this plan" iconRight="arrowRight" onPress={use} /> : undefined}>
      <View style={styles.page}>
        <View style={styles.header}>
          <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />
        </View>
        {body}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s18 },
  header: { flexDirection: 'row' },
  intro: { gap: space.s6 },
  badges: { flexDirection: 'row', gap: space.s6, marginTop: space.xs },
});
