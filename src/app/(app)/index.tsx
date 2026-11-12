import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { displayName, useAuth } from '@/lib/auth';
import { formatTripDates } from '@/lib/dates';
import { useMyProfile } from '@/lib/profile';
import { useTrips, type Trip } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const fill = tripColors[trip.color] ?? tripColors.sunset;
  const dates = trip.status === 'locked' && trip.locked_start && trip.locked_end ? formatTripDates(trip.locked_start, trip.locked_end) : null;
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(index * 70).springify().damping(16)}
      layout={reduced ? undefined : LinearTransition.springify()}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${trip.name}, ${trip.status === 'locked' ? 'locked in' : 'still planning'}${dates ? `, ${dates}` : ''}`}
        accessibilityHint="Opens the trip"
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
        style={({ pressed }) => [styles.trip, { backgroundColor: fill, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <View style={[styles.pill, { backgroundColor: colors.onColor }]}>
          <Text variant="caption" style={{ color: fill, fontWeight: '600' }}>
            {trip.status === 'locked' ? 'Locked in' : 'Planning'}
          </Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="title" tone="onColor" numberOfLines={2}>
            {trip.name}
          </Text>
          {dates ? (
            <Text variant="caption" tone="onColor">
              {dates}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: space.md, alignItems: 'flex-start' }}>
      <View style={styles.swatches} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Object.values(tripColors).map((c, i) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c, borderColor: colors.card, marginLeft: i ? -10 : 0 }]} />
        ))}
      </View>
      <Text variant="heading">Start your first trip</Text>
      <Text variant="body" tone="secondary">
        Give it a name, invite the group, and let everyone mark when they’re free.
      </Text>
    </Card>
  );
}

export default function Home() {
  const { session } = useAuth();
  const { trips, loading, error, refresh } = useTrips();
  const { colors } = useTheme();
  const { profile, refresh: refreshProfile } = useMyProfile(session?.user.id);
  const name = profile?.display_name ?? displayName(session);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProfile();
    }, [refresh, refreshProfile]),
  );

  return (
    <Screen footer={
        <View style={{ gap: space.sm }}>
          <Button label="New trip" onPress={() => router.push('/new-trip')} />
          <Button label="Join with a code" variant="secondary" onPress={() => router.push('/join')} />
        </View>
      }>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="secondary">
            Your trips
          </Text>
          <Text variant="title">Hey {name.split(' ')[0]}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          accessibilityHint="Edit your name and avatar, or sign out"
          onPress={() => router.push('/profile')}
          style={styles.avatar}>
          <Avatar name={name} url={profile?.avatar_url} color={profile?.avatar_color} fallbackColor={colors.celebrate} size={MIN_TOUCH} />
        </Pressable>
      </View>

      {error ? (
        <Text variant="caption" tone="danger" style={{ marginBottom: space.md }}>
          {error}
        </Text>
      ) : null}

      <View style={{ gap: space.md }}>
        {!loading && trips.length === 0 ? <EmptyState /> : null}
        {trips.map((t, i) => (
          <TripCard key={t.id} trip={t} index={i} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl, gap: space.md },
  avatar: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  trip: { borderRadius: radius.lg, padding: space.xl, minHeight: 150, justifyContent: 'space-between', gap: space.lg },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  swatches: { flexDirection: 'row' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
});
