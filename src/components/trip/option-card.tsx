import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/icon-tile';
import { Text } from '@/components/ui/text';
import { radius, space, type TintArea } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  title: string;
  sub?: string;
  icon?: IconName;
  area?: TintArea;
  selected: boolean;
  onPress: () => void;
  /** Defaults to "title, sub". */
  accessibilityLabel?: string;
  /** Something on the right, e.g. a "Leading" badge. */
  trailing?: ReactNode;
};

/** A choice row: 2px iris ring when picked, 1px line otherwise. Role radio. */
export function OptionCard({ title, sub, icon, area = 'vote', selected, onPress, accessibilityLabel, trailing }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? (sub ? `${title}, ${sub}` : title)}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.iris : colors.line,
          borderWidth: selected ? 2 : 1,
          // Keep the content still when the ring thickens.
          paddingHorizontal: selected ? space.lg - 1 : space.lg,
          paddingVertical: selected ? space.md - 1 : space.md,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? <IconTile area={area} icon={icon} /> : null}
      <View style={styles.text}>
        <Text variant="label" numberOfLines={2}>
          {title}
        </Text>
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 64, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: space.xxs },
});
