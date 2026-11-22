import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pip } from '@/components/pip/pip';
import { Confetti } from '@/components/trip/confetti';
import { countdownShort } from '@/components/trip/countdown-text';
import { markLockedSeen } from '@/components/trip/locked-seen';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { addTripToCalendar } from '@/lib/calendar';
import { formatRange, today } from '@/lib/dates';
import { useTripLive } from '@/lib/realtime';
import { countdown } from '@/lib/trip-status';
import { useTrip } from '@/lib/trips';
import { MAX_CONTENT_WIDTH, radius, space, tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

export default function LockedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { trip, loading, refresh } = useTrip(id, session?.user.id);
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh, ['trips', 'trip_members', 'destinations']);

  useEffect(() => {
    if (id) markLockedSeen(id);
  }, [id]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/trip/[id]', params: { id: id ?? '' } });
  };

  const startPlanning = () => router.dismissTo({ pathname: '/trip/[id]/plan', params: { id: id ?? '' } });

  const place = trip?.destinations.find((d) => d.id === trip.locked_destination_id);
  const start = trip?.locked_start;
  const end = trip?.locked_end;
  const cd = start && end ? countdownShort(countdown({ start, end }, today())) : null;
  const n = trip?.members.length ?? 0;

  const [calendarError, setCalendarError] = useState(false);
  const addToCalendar = () => {
    if (!trip || !start || !end) return;
    setCalendarError(false);
    addTripToCalendar({ id: trip.id, name: trip.name, start, end, place: place?.title }).catch(() => setCalendarError(true));
  };

  const ground = { backgroundColor: colors.beak };

  if (!trip || trip.status !== 'locked') {
    return (
      <View style={[styles.root, ground, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {loading && !trip ? (
          <ActivityIndicator color={colors.onBeak} accessibilityLabel="Loading" />
        ) : (
          <View style={styles.missing}>
            <Pip mood="hmm" size={96} />
            <Text variant="body" tone="onBeak" style={styles.centerText}>
              {trip ? "This trip isn't locked in right now." : "This trip doesn't exist, or you're not a member of it."}
            </Text>
            <Button label="Close" variant="ink" onPress={close} style={styles.wide} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, ground]}>
      <Confetti />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space.s28, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.column}>
          <View style={styles.top}>
            <Pip mood="yay" size={180} shadow scarf={tripColors.iris} beakColor={tripColors.coral} accessibilityLabel="Pip jumping for joy" />
            <Text variant="calloutStrong" tone="onBeak">
              It&apos;s official
            </Text>
            <Text variant="hero" tone="onBeak" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6} style={styles.centerText}>
              {place ? `${place.title}, here we come!` : 'Here we come!'}
            </Text>
          </View>

          <Animated.View
            entering={reduced ? undefined : FadeInDown.delay(250).springify().damping(16)}
            style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.columns}>
              <View style={styles.col}>
                <Text variant="caption" tone="secondary">
                  Where
                </Text>
                <Text variant="cardTitle">{place?.title ?? 'To be decided'}</Text>
              </View>
              <View style={[styles.col, styles.right]}>
                <Text variant="caption" tone="secondary">
                  When
                </Text>
                <Text variant="cardTitle" style={styles.rightText}>
                  {start && end ? formatRange(start, end) : ''}
                </Text>
              </View>
            </View>
            <View style={[styles.going, { borderTopColor: colors.line }]}>
              <AvatarStack
                people={trip.members.map((m) => ({ name: m.display_name, url: m.avatar_url, color: m.avatar_color }))}
                ring={colors.card}
                max={5}
              />
              <Text variant="calloutStrong" style={styles.goingText}>
                {n} going{cd ? ` · ${cd}` : ''}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.actions}>
            <Button label="Start planning the days" variant="ink" onPress={startPlanning} />
            <Button label="Add to calendar" variant="outlineInk" onPress={addToCalendar} />
            {calendarError ? (
              <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
                Couldn&apos;t add it to your calendar. Try again.
              </Text>
            ) : null}
            <Button label="Close" variant="ghostInk" onPress={close} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  missing: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.screenX, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  wide: { alignSelf: 'stretch' },
  scroll: { flexGrow: 1, paddingHorizontal: space.screenX },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: space.s20 },
  top: { alignItems: 'center', gap: space.md },
  card: { borderRadius: radius.xl, paddingVertical: space.s18, paddingHorizontal: space.s20, gap: space.s14 },
  columns: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  col: { flexShrink: 1, gap: space.xxs },
  right: { alignItems: 'flex-end' },
  rightText: { textAlign: 'right' },
  going: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, borderTopWidth: 1, paddingTop: space.s14 },
  goingText: { flexShrink: 1, textAlign: 'right' },
  actions: { marginTop: 'auto', gap: space.s10 },
});
