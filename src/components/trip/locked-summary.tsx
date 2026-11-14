import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { PlacePhoto } from '@/components/place-photo';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { addTripToCalendar } from '@/lib/calendar';
import { formatTripDates, nightsBetween, today } from '@/lib/dates';
import { hostOf } from '@/lib/destinations';
import { countdown } from '@/lib/trip-status';
import { planMessage, type TripDetail } from '@/lib/trips';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { countdownShort, nightsText } from './countdown-text';
import { useShareOrCopy } from './share';

/** The locked trip's place and dates, who's going, and Share plan / Add to calendar. */
export function LockedSummary({ trip }: { trip: TripDetail }) {
  const { colors } = useTheme();
  const { share, copied } = useShareOrCopy();
  const place = trip.destinations.find((d) => d.id === trip.locked_destination_id);
  const start = trip.locked_start;
  const end = trip.locked_end;
  const dates = start && end ? formatTripDates(start, end) : '';
  const cd = start && end ? countdownShort(countdown({ start, end }, today())) : null;
  const n = trip.members.length;

  const sharePlan = () => share(planMessage(trip.name, dates, place?.title ?? 'a place to be decided'));
  const addToCalendar = () => {
    if (!start || !end) return;
    addTripToCalendar({ id: trip.id, name: trip.name, start, end, place: place?.title }).catch(() => {});
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {place ? (
        <PlacePhoto place={place} accessibilityLabel={`Photo of ${place.title}`} style={[styles.photo, { backgroundColor: colors.track }]} />
      ) : null}
      <View style={styles.body}>
        {!place ? (
          <Text variant="callout" tone="secondary">
            The chosen place is no longer available.
          </Text>
        ) : null}
        <View style={styles.columns}>
          {place ? (
            <View style={styles.col}>
              <Text variant="caption" tone="secondary">
                Where
              </Text>
              <Text variant="cardTitle">{place.title}</Text>
              {place.note ? (
                <Text variant="caption" tone="secondary">
                  {place.note}
                </Text>
              ) : null}
              {place.url ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open link, ${hostOf(place.url)}`}
                  onPress={() => Linking.openURL(place.url!).catch(() => {})}
                  hitSlop={8}>
                  <Text variant="calloutStrong" tone="iris">
                    {hostOf(place.url)} ↗
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {start && end ? (
            <View style={[styles.col, place && styles.right]}>
              <Text variant="caption" tone="secondary">
                When
              </Text>
              <Text variant="cardTitle" style={place && styles.rightText}>
                {dates}
              </Text>
              <Text variant="caption" tone="secondary">
                {nightsText(nightsBetween(start, end))}
              </Text>
            </View>
          ) : null}
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
        <View style={styles.buttons}>
          <Button label="Share plan" icon="share" variant="outline" size="md" onPress={sharePlan} style={styles.flex} />
          <Button label="Add to calendar" icon="plan" variant="outline" size="md" onPress={addToCalendar} style={styles.flex} />
        </View>
        {copied ? (
          <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite" style={styles.center}>
            Copied!
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 16 / 9 },
  body: { paddingHorizontal: space.s20, paddingVertical: space.s18, gap: space.s14 },
  columns: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  col: { flexShrink: 1, gap: space.xxs },
  right: { alignItems: 'flex-end' },
  rightText: { textAlign: 'right' },
  going: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, borderTopWidth: 1, paddingTop: space.s14 },
  goingText: { flexShrink: 1, textAlign: 'right' },
  buttons: { flexDirection: 'row', gap: space.s10 },
  flex: { flex: 1, paddingHorizontal: space.md },
  center: { textAlign: 'center' },
});
