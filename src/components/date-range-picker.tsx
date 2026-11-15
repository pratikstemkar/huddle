import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { addDays, formatDay, formatRange, monthGrids, today as todayDay, type Day } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export type DayRange = { start: string; end: string };

type Props = {
  value: DayRange | null;
  onChange: (v: DayRange | null) => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL = 44;

const monthKey = (day: Day) => day.slice(0, 7);

function shiftMonth(key: string, by: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * A month calendar for picking a trip's dates: tap the first day, then the last.
 * The first tap already makes a one-day range, so the value is always usable.
 */
export function DateRangePicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const now = todayDay();
  const [month, setMonth] = useState(() => monthKey(value?.start ?? now));
  // The first tap of a range, waiting for the last day.
  const [anchor, setAnchor] = useState<Day | null>(null);

  const grid = useMemo(() => monthGrids(`${month}-01`, `${month}-01`)[0], [month]);
  const canGoBack = month > monthKey(now);

  const pick = (day: Day) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (anchor) {
      const [start, end] = day < anchor ? [day, anchor] : [anchor, day];
      setAnchor(null);
      onChange({ start, end });
    } else {
      setAnchor(day);
      onChange({ start: day, end: day });
    }
  };

  const summary = value
    ? anchor
      ? `${formatDay(value.start, { day: 'numeric', month: 'short' })}, now tap the last day`
      : formatRange(value.start, value.end)
    : 'Tap the first day, then the last';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          hitSlop={4}
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          style={[styles.nav, { opacity: canGoBack ? 1 : 0.3 }]}>
          <Icon name="back" size={20} />
        </Pressable>
        <Text variant="label" accessibilityRole="header">
          {grid.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={4}
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          style={styles.nav}>
          <Icon name="chevronRight" size={20} />
        </Pressable>
      </View>

      <View style={styles.row} aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} variant="badge" tone="secondary" style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.weeks}>
        {grid.weeks.map((week, wi) => (
          <View key={wi} style={styles.row}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.slot} />;
              const past = day < now;
              const inRange = !!value && day >= value.start && day <= value.end;
              const edge = !!value && (day === value.start || day === value.end);
              const startsRow = inRange && (di === 0 || day === value!.start || addDays(day, -1) < value!.start);
              const endsRow = inRange && (di === 6 || day === value!.end || addDays(day, 1) > value!.end);
              return (
                <View
                  key={di}
                  style={[
                    styles.slot,
                    inRange && { backgroundColor: colors.iris },
                    startsRow && { borderTopLeftRadius: radius.tile, borderBottomLeftRadius: radius.tile },
                    endsRow && { borderTopRightRadius: radius.tile, borderBottomRightRadius: radius.tile },
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}${
                      edge ? (day === value!.start ? ', first day' : ', last day') : inRange ? ', in your dates' : ''
                    }`}
                    accessibilityState={{ selected: inRange, disabled: past }}
                    disabled={past}
                    onPress={() => pick(day)}
                    style={[styles.cell, { opacity: past ? 0.35 : 1 }]}>
                    <Text variant="label" style={{ color: inRange ? colors.onIris : colors.text, fontWeight: edge ? '700' : '600' }}>
                      {Number(day.slice(8))}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite" style={styles.summary}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  weeks: { gap: space.xs },
  weekday: { flex: 1, textAlign: 'center' },
  slot: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cell: { width: CELL, maxWidth: '100%', height: CELL, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  summary: { textAlign: 'center' },
});
