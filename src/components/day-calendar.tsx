import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';

import { formatDay, monthGrids, type Day, type MonthGrid } from '@/lib/dates';
import { MAX_CONTENT_WIDTH, MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Text } from './ui/text';

export type CalendarMode = 'mine' | 'all';

/** A member as the calendar shows them: a name for screen readers and a colour for their dot. */
export type CalendarPerson = { name: string; color: string };

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
  /** Who is free on each day. When given with `people`, Everyone mode shows a dot per person. */
  who?: Map<Day, string[]>;
  people?: Map<string, CalendarPerson>;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKS = 6;
const CELL = 44;
const ROW_GAP = 4;
const MAX_DOTS = 3;
const TODAY_H = 32;

type CellProps = {
  day: Day;
  past: boolean;
  mode: CalendarMode;
  mine: boolean;
  count: number;
  total: number;
  selected: boolean;
  readOnly: boolean;
  /** People free on this day, in the order they marked it; empty when names are hidden. */
  marked: CalendarPerson[] | undefined;
  onToggle: (day: Day, free: boolean) => void;
  onSelect: (day: Day) => void;
};

const Cell = memo(function Cell({ day, past, mode, mine, count, total, selected, readOnly, marked, onToggle, onSelect }: CellProps) {
  const { colors } = useTheme();
  const level = count === 0 ? 0 : Math.min(3, Math.ceil((count / Math.max(total, 1)) * 3));
  const fill = mode === 'mine' ? (mine ? colors.accent : 'transparent') : colors.heat[level];
  const strong = mode === 'mine' ? mine : level >= 3;
  const textColor = strong ? colors.onColor : past ? colors.textMuted : colors.text;
  const editable = mode === 'mine' && !readOnly && !past;
  const selectable = mode === 'all';
  const dots = mode === 'all' && marked?.length ? marked : null;

  const label = `${formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}${
    past ? ', not available' : mine ? ', you are free' : ''
  }${mode === 'all' || count > 0 ? `, ${count} of ${total} free` : ''}${dots ? `: ${dots.map((p) => p.name).join(', ')}` : ''}`;

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
      {dots ? (
        <View style={styles.dots} testID={`dots-${day}`}>
          {dots.slice(0, dots.length > MAX_DOTS ? MAX_DOTS - 1 : MAX_DOTS).map((p, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: p.color, borderColor: colors.card }]} />
          ))}
          {dots.length > MAX_DOTS ? (
            <Text variant="caption" style={[styles.more, { color: textColor }]}>
              +{dots.length - (MAX_DOTS - 1)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

type MonthProps = Omit<Props, 'from' | 'to' | 'onSelect' | 'onToggle' | 'who' | 'people'> & {
  month: MonthGrid;
  from: Day;
  to: Day;
  width: number;
  marked: Map<Day, CalendarPerson[]>;
  onToggle: (day: Day, free: boolean) => void;
  onSelect: (day: Day) => void;
};

function Month({ month, width, from, to, today, mode, myDays, counts, memberCount, selected, readOnly, marked, onToggle, onSelect }: MonthProps) {
  // Every month gets six rows so the pager doesn't change height as you swipe.
  const weeks = [...month.weeks];
  while (weeks.length < WEEKS) weeks.push(Array(7).fill(null));
  return (
    <View style={{ width, gap: ROW_GAP }}>
      {weeks.map((week, wi) => (
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
                marked={marked.get(day)}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * One month at a time from `from` to `to`: swipe sideways or use the arrows to change month.
 * Mine mode toggles my days; Everyone mode shades by how many are free, with a dot per person when names are shown.
 */
export function DayCalendar({ from, to, today, mode, myDays, counts, memberCount, selected, readOnly, onToggle, onSelect, who, people }: Props) {
  const { colors } = useTheme();
  const months = useMemo(() => monthGrids(from, to), [from, to]);
  const window = useWindowDimensions();
  // A first guess from the screen size so the first frame isn't empty; onLayout gives the real width.
  const [width, setWidth] = useState(() => Math.max(0, Math.min(window.width, MAX_CONTENT_WIDTH) - 2 * space.xl));
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<MonthGrid>>(null);
  // The month an arrow is scrolling to. While set, the animation's in-between offsets don't move the index,
  // or the header would flick back to the old month for the first half of the scroll.
  const target = useRef<number | null>(null);
  // Lets go of `target` once the pager has been still for a moment, in case the scroll never lands exactly.
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);

  const marked = useMemo(() => {
    const out = new Map<Day, CalendarPerson[]>();
    if (!who || !people) return out;
    for (const [day, ids] of who) {
      const list = ids.map((id) => people.get(id)).filter((p): p is CalendarPerson => !!p);
      if (list.length) out.set(day, list);
    }
    return out;
  }, [who, people]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(months.length - 1, i));
      target.current = next;
      // The scroll can start a good while after the tap on a busy device, so wait long before giving up on it.
      clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        target.current = null;
      }, 2000);
      setIndex(next);
      list.current?.scrollToOffset({ offset: next * width, animated: true });
    },
    [months.length, width],
  );

  // onScroll rather than onMomentumScrollEnd: the web has no momentum events.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    const valid = i >= 0 && i < months.length;
    if (target.current !== null) {
      clearTimeout(settle.current);
      if (Math.abs(e.nativeEvent.contentOffset.x - target.current * width) < 1) target.current = null;
      else
        settle.current = setTimeout(() => {
          target.current = null;
          if (valid) setIndex(i);
        }, 300);
      return;
    }
    if (i !== index && valid) setIndex(i);
  };

  const month = months[index] ?? months[0];
  const monthDays = month ? month.weeks.flat().filter((d): d is Day => !!d) : [];
  const mineThisMonth = monthDays.filter((d) => myDays.has(d)).length;
  const first = index === 0;
  const last = index === months.length - 1;

  const arrow = (dir: -1 | 1) => {
    const disabled = dir < 0 ? first : last;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? 'Previous month' : 'Next month'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => goTo(index + dir)}
        hitSlop={4}
        style={[styles.arrow, { backgroundColor: colors.card, opacity: disabled ? 0.35 : 1 }]}>
        <Text variant="title" accessibilityRole="none" style={{ lineHeight: 30 }}>
          {dir < 0 ? '‹' : '›'}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.header}>
        {arrow(-1)}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="heading" accessibilityLiveRegion="polite">
            {month?.label}
          </Text>
          {/* Always laid out, so the header doesn't change height when it appears. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to this month"
            accessibilityElementsHidden={index === 0}
            importantForAccessibility={index === 0 ? 'no-hide-descendants' : 'auto'}
            disabled={index === 0}
            onPress={() => goTo(0)}
            // The chip is drawn 32 tall; the slop takes the touch area to 44.
            hitSlop={{ top: (MIN_TOUCH - TODAY_H) / 2, bottom: (MIN_TOUCH - TODAY_H) / 2, left: space.sm, right: space.sm }}
            style={({ pressed }) => [
              styles.today,
              { backgroundColor: pressed ? colors.cardMuted : colors.card, borderColor: colors.line, opacity: index === 0 ? 0 : 1 },
              pressed && { transform: [{ scale: 0.96 }] },
            ]}>
            <Text variant="caption" tone="accent" style={{ fontWeight: '600' }}>
              Today
            </Text>
          </Pressable>
        </View>
        {arrow(1)}
      </View>

      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={styles.head}>
            <Text variant="caption" tone="muted">
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View onLayout={onLayout} style={{ height: WEEKS * CELL + (WEEKS - 1) * ROW_GAP }}>
        {width > 0 ? (
          <FlatList
            ref={list}
            testID="month-pager"
            data={months}
            keyExtractor={(m) => m.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            // A finger on the pager takes over from any arrow scroll still running.
            onScrollBeginDrag={() => {
              clearTimeout(settle.current);
              target.current = null;
            }}
            scrollEventThrottle={32}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            initialNumToRender={2}
            windowSize={3}
            extraData={[mode, myDays, counts, selected, readOnly, marked, memberCount]}
            renderItem={({ item }) => (
              <Month
                month={item}
                width={width}
                from={from}
                to={to}
                today={today}
                mode={mode}
                myDays={myDays}
                counts={counts}
                memberCount={memberCount}
                selected={selected}
                readOnly={readOnly}
                marked={marked}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          />
        ) : null}
      </View>

      {mode === 'mine' ? (
        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {mineThisMonth === 0 ? 'No days marked this month' : `${mineThisMonth} ${mineThisMonth === 1 ? 'day' : 'days'} marked this month`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  today: { height: TODAY_H, paddingHorizontal: space.md, marginTop: space.xs, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: ROW_GAP },
  head: { flex: 1, alignItems: 'center', paddingVertical: space.xs },
  blank: { flex: 1, height: CELL },
  cell: { flex: 1, height: CELL, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  more: { fontSize: 9, lineHeight: 10 },
});
