import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ItineraryCard } from '@/components/explore/itinerary-card';
import { PhotoCredit } from '@/components/explore/photo-credit';
import { goBack } from '@/components/explore/go-back';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { coverUrl, useCatalogDestination } from '@/lib/catalog';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ExploreDestination() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ destination: string; group?: string }>();
  const id = typeof params.destination === 'string' ? params.destination : undefined;
  const group = typeof params.group === 'string' && params.group ? params.group : undefined;
  const { destination, itineraries, loading, error, refresh } = useCatalogDestination(id);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  let body;
  if (loading && !destination) body = <Loading label="Loading plans" />;
  else if (error && !destination) body = <ErrorState message={error} onRetry={refresh} />;
  else if (!destination)
    body = <ErrorState title="Not found" message="That place isn't in the list any more. Pick another one." />;
  else
    body = (
      <>
        <View style={[styles.hero, { backgroundColor: colors.tint.trip }]}>
          <Image
            source={{ uri: coverUrl(destination.cover_url, 1200, 900) }}
            contentFit="cover"
            transition={200}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        </View>
        <View style={styles.intro}>
          <Text variant="title">{destination.name}</Text>
          <Text variant="callout" tone="secondary">
            {destination.country}
          </Text>
          <Text variant="body">{destination.blurb}</Text>
          <PhotoCredit name={destination.photo_credit} />
        </View>

        <View style={styles.list}>
          <Text variant="heading">Pick a plan</Text>
          {itineraries.map((it) => (
            <ItineraryCard
              key={it.id}
              itinerary={it}
              onPress={() => router.push({ pathname: '/explore/plan/[id]', params: { id: it.id, ...(group ? { group } : {}) } })}
            />
          ))}
        </View>
      </>
    );

  return (
    <Screen>
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
  hero: { aspectRatio: 16 / 10, borderRadius: radius.card, overflow: 'hidden' },
  intro: { gap: space.xs },
  list: { gap: space.listGap },
});
