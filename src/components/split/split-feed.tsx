import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/money';
import type { FeedItem } from '@/lib/split';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { CATEGORY_LOOK, expenseSubtitle, settlementTitle } from './people';

type Props = {
  items: FeedItem[];
  names: Map<string, string>;
  me: string | undefined;
  currency: string;
  isOrganiser: boolean;
  onEditExpense: (id: string) => void;
  onUndoSettlement: (id: string) => void;
};

/** Expenses and settlements, newest first, in one card. */
export function SplitFeed({ items, names, me, currency, isOrganiser, onEditExpense, onUndoSettlement }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        if (item.kind === 'expense') {
          const e = item.expense;
          const look = CATEGORY_LOOK[e.category] ?? CATEGORY_LOOK.other;
          const editable = !!me && (e.created_by === me || isOrganiser);
          return (
            <Row
              key={`e:${e.id}`}
              last={last}
              tile={
                <IconTile area={look.area}>
                  <Icon name={look.icon} size={20} color={colors.text} />
                </IconTile>
              }
              title={e.title}
              subtitle={expenseSubtitle(e, names, me)}
              amount={formatMoney(e.amount_minor, currency)}
              onPress={editable ? () => onEditExpense(e.id) : undefined}
              hint="Edit expense"
            />
          );
        }
        const s = item.settlement;
        const mine = !!me && s.created_by === me;
        return (
          <Row
            key={`s:${s.id}`}
            last={last}
            tile={
              <IconTile area="split">
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" />
                </Svg>
              </IconTile>
            }
            title={settlementTitle(s, names, me)}
            subtitle="settled up"
            amount={formatMoney(s.amount_minor, currency)}
            onPress={mine ? () => onUndoSettlement(s.id) : undefined}
            hint="Undo this payment"
          />
        );
      })}
    </View>
  );
}

type RowProps = {
  tile: ReactNode;
  title: string;
  subtitle: string;
  amount: string;
  last: boolean;
  onPress?: () => void;
  hint: string;
};

function Row({ tile, title, subtitle, amount, last, onPress, hint }: RowProps) {
  const { colors } = useTheme();
  const label = `${title}, ${amount}, ${subtitle}`;
  const body = (
    <>
      {tile}
      <View style={styles.middle}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text variant="label">{amount}</Text>
    </>
  );
  const rowStyle = [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }];
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={rowStyle}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.6 }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, paddingVertical: space.xs, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 64 },
  middle: { flex: 1, minWidth: 0, gap: space.xxs },
});
