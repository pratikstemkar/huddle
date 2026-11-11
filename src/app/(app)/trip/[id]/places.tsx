import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DestinationCard } from '@/components/destination-card';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { useDestinations } from '@/lib/destinations';
import { useTrip } from '@/lib/trips';
import { MIN_TOUCH, space, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function goBack(id: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/trip/[id]', params: { id } });
}

export default function PlacesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { trip, loading: tripLoading, error: tripError, refresh: refreshTrip } = useTrip(id, me);
  const d = useDestinations(id, me);
  const refreshDestinations = d.refresh;

  useFocusEffect(
    useCallback(() => {
      refreshTrip();
      refreshDestinations();
    }, [refreshTrip, refreshDestinations]),
  );

  useTripLive(id, () => {
    refreshTrip();
    refreshDestinations();
  });

  const names = useMemo(() => new Map((trip?.members ?? []).map((m) => [m.user_id, m.display_name])), [trip]);

  if ((tripLoading && !trip) || (d.loading && !tripError)) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading places" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <Text variant="title">{tripError ? 'Something went wrong' : 'Trip not found'}</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: space.sm }}>
          {tripError ?? "This trip doesn't exist, or you're not a member of it."}
        </Text>
      </Screen>
    );
  }

  const locked = trip.status === 'locked';
  const isOrganiser = trip.members.some((m) => m.user_id === me && m.role === 'organiser');
  const fill = tripColors[trip.color] ?? tripColors.sunset;
  const error = d.error ?? tripError;

  return (
    <Screen
      footer={
        !locked ? (
          <Button label="Suggest a place" onPress={() => router.push({ pathname: '/trip/[id]/suggest', params: { id: trip.id } })} />
        ) : undefined
      }>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the trip" onPress={() => goBack(trip.id)} hitSlop={8} style={[styles.back, { backgroundColor: colors.card }]}>
          <Text variant="title" style={{ lineHeight: 30 }}>
            ‹
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="title">Where to?</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {trip.name}
          </Text>
        </View>
      </View>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.md }}>
          {error}
        </Text>
      ) : null}

      {d.list.length === 0 ? (
        <View style={[styles.center, { gap: space.sm, paddingTop: space.xxl }]}>
          <Text variant="heading" style={{ textAlign: 'center' }}>
            No places yet
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            Suggest somewhere to go, then everyone can vote.
          </Text>
        </View>
      ) : (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {d.list.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              names={names}
              fill={fill}
              readOnly={locked}
              canRemove={dest.created_by === me || isOrganiser}
              onVote={() => d.toggleVote(dest.id)}
              onRemove={() => d.remove(dest.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
});
