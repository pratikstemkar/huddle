import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatDay, fromDay, type Day } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const GRID_MAX = 5;
const CHIP_WIDTH = 64;
const GAP = space.sm;

type Props = {
  days: Day[];
  selected: Day;
  /** How many plans each day has (days with none can be left out). */
  counts: Map<Day, number>;
  onSelect: (day: Day) => void;
};

export function dayChipLabel(day: Day, count: number) {
  const date = formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' });
  return `${date}, ${count} ${count === 1 ? 'plan' : 'plans'}`;
}

function DayChip({ day, selected, count, onPress, grid }: { day: Day; selected: boolean; count: number; onPress: () => void; grid: boolean }) {
  const { colors } = useTheme();
  const look = selected
    ? { backgroundColor: colors.iris, borderWidth: 0 }
    : count > 0
      ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }
      : { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed' as const, borderColor: colors.dashed };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dayChipLabel(day, count)}
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, grid ? styles.gridChip : styles.scrollChip, look, pressed && !selected && { opacity: 0.7 }]}>
      <Text variant="badge" style={{ color: selected ? colors.onIris : colors.textSecondary }}>
        {formatDay(day, { weekday: 'short' })}
      </Text>
      <Text variant="numberSm" style={{ color: selected ? colors.onIris : colors.text }}>
        {fromDay(day).getUTCDate()}
      </Text>
    </Pressable>
  );
}

/** The trip's days: a five-column grid for short trips, a scrolling row for longer ones. */
export function DayStrip({ days, selected, counts, onSelect }: Props) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const grid = days.length <= GRID_MAX;
  const index = days.indexOf(selected);

  const scrolled = useRef(false);

  // Brings the first selected day (e.g. today) into view once; later taps leave the scroll where it is.
  useEffect(() => {
    if (grid || index < 0 || scrolled.current) return;
    scrolled.current = true;
    scroller.current?.scrollTo({ x: Math.max(0, index * (CHIP_WIDTH + GAP) - CHIP_WIDTH), animated: false });
  }, [grid, index]);

  const chips = days.map((d) => (
    <DayChip key={d} day={d} selected={d === selected} count={counts.get(d) ?? 0} onPress={() => onSelect(d)} grid={grid} />
  ));

  if (grid) {
    return (
      <View style={styles.grid}>
        {chips}
        {Array.from({ length: GRID_MAX - days.length }, (_, i) => (
          <View key={`spacer-${i}`} style={styles.gridChip} />
        ))}
      </View>
    );
  }
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroller}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: GAP },
  row: { gap: GAP, paddingHorizontal: space.screenX },
  scroller: { marginHorizontal: -space.screenX, flexGrow: 0 },
  chip: { height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
  gridChip: { flex: 1, minWidth: 0 },
  scrollChip: { width: CHIP_WIDTH },
});
