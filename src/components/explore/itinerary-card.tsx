import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { daysLabel, highlights, nightsLabel, PACE_LABEL, type ItineraryWithItems } from '@/lib/catalog';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** One ready-made plan in a destination's list: title, length, pace and a few highlights. */
export function ItineraryCard({ itinerary: it, onPress }: { itinerary: ItineraryWithItems; onPress: () => void }) {
  const { colors } = useTheme();
  const picks = highlights(it.items, it.nights);
  const length = `${nightsLabel(it.nights)}, ${daysLabel(it.nights)}`;
  return (
    <Card
      onPress={onPress}
      chevron
      accessibilityLabel={`${it.title}, ${length}, ${PACE_LABEL[it.pace]}`}
      accessibilityHint="Shows the day-by-day plan">
      <View style={styles.body}>
        <Text variant="cardTitle">{it.title}</Text>
        <Text variant="callout" tone="secondary">
          {it.summary}
        </Text>
        <View style={styles.badges}>
          <Badge label={nightsLabel(it.nights)} />
          <Badge label={PACE_LABEL[it.pace]} tone="neutral" />
        </View>
        {picks.length ? (
          <View style={styles.picks}>
            {picks.map((p) => (
              <View key={p} style={styles.pick}>
                <View style={[styles.dot, { backgroundColor: colors.beak }]} />
                <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
                  {p}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space.s6 },
  badges: { flexDirection: 'row', gap: space.s6, marginTop: space.xxs },
  picks: { gap: space.xs, marginTop: space.xs },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  flex: { flex: 1 },
});
