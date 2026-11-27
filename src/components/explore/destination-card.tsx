import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { coverUrl, lengthRange, type DestinationCard as Destination } from '@/lib/catalog';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  destination: Destination;
  onPress: () => void;
  /** `compact` is the small card in the home ideas row. */
  size?: 'grid' | 'compact';
  style?: ViewStyle;
};

export function plansLine(d: Pick<Destination, 'plans' | 'shortest' | 'longest'>) {
  const plans = `${d.plans} ${d.plans === 1 ? 'plan' : 'plans'}`;
  const length = lengthRange(d.shortest, d.longest);
  return length ? `${plans} · ${length}` : plans;
}

/** A destination's photo with its name, country and how many ready-made plans it has. */
export function DestinationCard({ destination: d, onPress, size = 'grid', style }: Props) {
  const { colors } = useTheme();
  const compact = size === 'compact';
  const line = plansLine(d);
  return (
    <PressableScale
      pressedScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${d.name}, ${d.country}, ${line}`}
      accessibilityHint="Shows the ready-made plans"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, compact && styles.compact, style]}>
      <View style={[styles.photo, compact && styles.photoCompact, { backgroundColor: colors.tint.trip }]}>
        <Image
          source={{ uri: coverUrl(d.cover_url, compact ? 400 : 600, compact ? 300 : 450) }}
          contentFit="cover"
          transition={200}
          recyclingKey={d.id}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.body}>
        <Text variant="label" numberOfLines={1}>
          {d.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {compact ? d.country : `${d.country} · ${line}`}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  compact: { width: 148 },
  photo: { aspectRatio: 4 / 3, width: '100%', overflow: 'hidden' },
  photoCompact: { aspectRatio: 4 / 3 },
  body: { paddingHorizontal: space.md, paddingVertical: space.s10, gap: space.xxs },
});
