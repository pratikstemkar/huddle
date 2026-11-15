import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatTime, type PlanItem } from '@/lib/itinerary';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  items: PlanItem[];
  /** Who added an item: "you", a name, or "Someone". */
  addedBy: (item: PlanItem) => string;
  canEdit: (item: PlanItem) => boolean;
  onEdit: (item: PlanItem) => void;
  /** Shown before the time, e.g. the date for plans that aren't on the trip's days. */
  prefix?: (item: PlanItem) => string;
};

export function planSubtitle(item: PlanItem, by: string) {
  return item.note ? `${item.note} · added by ${by}` : `Added by ${by}`;
}

/** One day's plans: time, title, then the note and who added it. */
export function PlanList({ items, addedBy, canEdit, onEdit, prefix }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      {items.map((item, i) => {
        const sub = planSubtitle(item, addedBy(item));
        const time = formatTime(item.start_time);
        const editable = canEdit(item);
        const lead = prefix ? `${prefix(item)}, ` : '';
        const content = (
          <>
            <Text variant="caption" style={[styles.time, { color: colors.textSecondary }]}>
              {time}
            </Text>
            <View style={styles.body}>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" tone="secondary">
                {prefix ? `${prefix(item)} · ` : ''}
                {sub}
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: i % 2 === 0 ? colors.beak : colors.iris }]} />
          </>
        );
        const rowStyle = [styles.row, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }];
        const label = `${lead}${time}, ${item.title}, ${sub}`;
        return editable ? (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint="Edit this plan"
            onPress={() => onEdit(item)}
            style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}>
            {content}
          </Pressable>
        ) : (
          <View key={item.id} accessible accessibilityLabel={label} style={rowStyle}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, paddingVertical: space.s6, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', gap: space.s14, paddingVertical: space.md },
  time: { width: 52, fontWeight: '600', paddingTop: space.xxs },
  body: { flex: 1, gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: space.s6 },
});
