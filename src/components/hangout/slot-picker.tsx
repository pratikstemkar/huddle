import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { EXACT_TIMES, PARTS, pickKey, slotForPart, weekLabel, type PartOfDay, type SlotPick } from '@/lib/hangouts';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const dow = new Intl.DateTimeFormat('en', { weekday: 'short' });
const label = (d: Date) => `${dow.format(d)} ${d.getDate()}`;

type GridProps = {
  days: Date[];
  picks: SlotPick[];
  onToggle: (day: Date, part: PartOfDay) => void;
  onWeek: (delta: -1 | 1) => void;
  canGoBack: boolean;
};

/** Five days by four parts of the day: tap a cell to suggest it. Times that have already passed are off. */
export function SlotGrid({ days, picks, onToggle, onWeek, canGoBack }: GridProps) {
  const { colors } = useTheme();
  const on = new Set(picks.map(pickKey));
  const [now] = useState(() => Date.now());
  return (
    <View style={styles.gridWrap}>
      <View style={styles.weekRow}>
        <Text variant="calloutStrong">{weekLabel(days)}</Text>
        <View style={styles.weekButtons}>
          <IconButton icon="back" accessibilityLabel="Previous week" onPress={canGoBack ? () => onWeek(-1) : undefined} />
          <IconButton icon="chevronRight" accessibilityLabel="Next week" onPress={() => onWeek(1)} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.rowLabel} />
        {days.map((d) => (
          <View key={d.toDateString()} style={styles.dayHead}>
            <Text variant="caption" tone="secondary">
              {dow.format(d)}
            </Text>
            <Text variant="label">{d.getDate()}</Text>
          </View>
        ))}
      </View>
      {PARTS.map((part) => (
        <View key={part.id} style={styles.row}>
          <View style={styles.rowLabel}>
            <Text variant="caption" style={{ fontWeight: '600' }}>
              {part.label}
            </Text>
            <Text variant="badge" tone="secondary">
              {part.sub}
            </Text>
          </View>
          {days.map((d) => {
            const selected = on.has(pickKey({ day: d, part: part.id }));
            const past = new Date(slotForPart(d, part.id, null).ends_at!).getTime() <= now;
            return (
              <Pressable
                key={d.toDateString()}
                accessibilityRole="button"
                accessibilityLabel={`${label(d)}, ${part.label.toLowerCase()}`}
                aria-selected={selected}
                aria-disabled={past}
                disabled={past}
                onPress={() => onToggle(d, part.id)}
                style={[
                  styles.cell,
                  { backgroundColor: selected ? colors.iris : colors.card, borderColor: selected ? colors.iris : colors.line, opacity: past ? 0.4 : 1 },
                ]}>
                {selected ? <Icon name="check" size={20} color={colors.onIris} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type TimeProps = {
  days: Date[];
  day: Date | null;
  time: { hour: number; minute: number } | null;
  onDay: (d: Date) => void;
  onTime: (t: { hour: number; minute: number }) => void;
};

/** A day and a time of day, as chips. Used to add an exact time, and to set the one time of an "I'll pick it" hangout. */
export function DayTimeChips({ days, day, time, onDay, onTime }: TimeProps) {
  return (
    <View style={styles.chipsWrap}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Day">
        {days.map((d) => (
          <Chip key={d.toDateString()} label={label(d)} selected={!!day && day.toDateString() === d.toDateString()} onPress={() => onDay(d)} />
        ))}
      </View>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Time">
        {EXACT_TIMES.map((t) => (
          <Chip
            key={t.label}
            label={t.label}
            selected={!!time && time.hour === t.hour && time.minute === t.minute}
            onPress={() => onTime({ hour: t.hour, minute: t.minute })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: { gap: space.sm },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekButtons: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s6 },
  rowLabel: { width: 64 },
  dayHead: { flex: 1, alignItems: 'center' },
  cell: { flex: 1, height: 48, borderRadius: radius.tile, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
