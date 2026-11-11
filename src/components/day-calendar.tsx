import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDay, monthGrids, type Day } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './ui/text';

export type CalendarMode = 'mine' | 'all';

type Props = {
  from: Day;
  to: Day;
  today: Day;
  mode: CalendarMode;
  myDays: Set<Day>;
  counts: Map<Day, number>;
  memberCount: number;
  selected: Day | null;
  /** Read-only calendars (locked trips) still let you select a day to see who's free. */
  readOnly: boolean;
  onToggle: (day: Day, free: boolean) => void;
  onSelect: (day: Day) => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type CellProps = {
  day: Day;
  past: boolean;
  mode: CalendarMode;
  mine: boolean;
  count: number;
  total: number;
  selected: boolean;
  readOnly: boolean;
  onToggle: (day: Day, free: boolean) => void;
  onSelect: (day: Day) => void;
};

const Cell = memo(function Cell({ day, past, mode, mine, count, total, selected, readOnly, onToggle, onSelect }: CellProps) {
  const { colors } = useTheme();
  const level = count === 0 ? 0 : Math.min(3, Math.ceil((count / Math.max(total, 1)) * 3));
  const fill = mode === 'mine' ? (mine ? colors.accent : 'transparent') : colors.heat[level];
  const strong = mode === 'mine' ? mine : level >= 3;
  const textColor = strong ? colors.onColor : past ? colors.textMuted : colors.text;
  const editable = mode === 'mine' && !readOnly && !past;
  const selectable = mode === 'all';

  const label = `${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}${
    past ? ', not available' : mine ? ', you are free' : ''
  }${mode === 'all' || count > 0 ? `, ${count} of ${total} free` : ''}`;

  const press = () => {
    if (editable) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(day, !mine);
    } else if (selectable) onSelect(day);
  };

  return (
    <Pressable
      accessibilityRole={editable || selectable ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: mode === 'mine' ? mine : selected, disabled: !editable && !selectable }}
      disabled={!editable && !selectable}
      onPress={press}
      style={[
        styles.cell,
        { backgroundColor: fill, opacity: past ? 0.4 : 1 },
        mode === 'all' && mine && { borderWidth: 2, borderColor: colors.text },
        mode === 'all' && selected && { borderWidth: 2, borderColor: colors.votes },
      ]}>
      <Text variant="label" style={{ color: textColor }}>
        {Number(day.slice(8))}
      </Text>
    </Pressable>
  );
});

/** Scrolling month grids from `from` to `to`. Mine mode toggles my days; Everyone mode shades by how many are free. */
export function DayCalendar({ from, to, today, mode, myDays, counts, memberCount, selected, readOnly, onToggle, onSelect }: Props) {
  const months = monthGrids(from, to);
  return (
    <View style={{ gap: space.xl }}>
      {months.map((m) => (
        <View key={m.key} style={{ gap: space.xs }}>
          <Text variant="heading">{m.label}</Text>
          <View style={styles.row} importantForAccessibility="no-hide-descendants">
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.head}>
                <Text variant="caption" tone="muted">
                  {w}
                </Text>
              </View>
            ))}
          </View>
          {m.weeks.map((week, wi) => (
            <View key={wi} style={styles.row}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.blank} />;
                const outside = day < from || day > to;
                return (
                  <Cell
                    key={day}
                    day={day}
                    past={day < today || outside}
                    mode={mode}
                    mine={myDays.has(day)}
                    count={counts.get(day) ?? 0}
                    total={memberCount}
                    selected={selected === day}
                    readOnly={readOnly}
                    onToggle={onToggle}
                    onSelect={onSelect}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  blank: { flex: 1, height: 44 },
  cell: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
