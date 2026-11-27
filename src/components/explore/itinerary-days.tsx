import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { itemsByDay, type CatalogItem } from '@/lib/catalog';
import { formatTime } from '@/lib/itinerary';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** A ready-made plan, read-only: "Day 1", then each item's time, title and note. */
export function ItineraryDays({ items }: { items: CatalogItem[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.days}>
      {itemsByDay(items).map(({ day, items: list }) => (
        <View key={day} style={styles.day}>
          <Text variant="heading" accessibilityRole="header">
            Day {day + 1}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            {list.map((item, i) => {
              const time = formatTime(item.start_time);
              return (
                <View
                  key={item.id}
                  accessible
                  accessibilityLabel={`${time}, ${item.title}${item.note ? `, ${item.note}` : ''}`}
                  style={[styles.row, i < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                  <Text variant="caption" style={[styles.time, { color: colors.textSecondary }]}>
                    {time}
                  </Text>
                  <View style={styles.body}>
                    <Text variant="bodyStrong">{item.title}</Text>
                    {item.note ? (
                      <Text variant="caption" tone="secondary">
                        {item.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: space.s18 },
  day: { gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.card, paddingVertical: space.s6, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', gap: space.s14, paddingVertical: space.md },
  time: { width: 52, fontWeight: '600', paddingTop: space.xxs },
  body: { flex: 1, gap: 3 },
});
