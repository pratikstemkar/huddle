import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { hostOf, type Destination } from '@/lib/destinations';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { Card } from './ui/card';
import { Text } from './ui/text';

type Props = {
  destination: Destination;
  /** Display name per user id, for "suggested by" and voters. */
  names: Map<string, string>;
  fill: string;
  readOnly: boolean;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
};

export function DestinationCard({ destination: d, names, fill, readOnly, canRemove, onVote, onRemove }: Props) {
  const { colors } = useTheme();
  const by = (d.created_by && names.get(d.created_by)) || 'Someone';
  const voterNames = d.voters.map((u) => names.get(u) ?? 'Someone');

  const vote = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onVote();
  };

  const confirmRemove = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Remove "${d.title}"? Its votes go too.`)) onRemove();
      return;
    }
    Alert.alert(`Remove "${d.title}"?`, 'Its votes go too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  };

  return (
    <Card style={{ gap: space.sm, padding: 0, overflow: 'hidden' }}>
      {d.image_url ? (
        <Image source={{ uri: d.image_url }} accessibilityLabel={`Photo of ${d.title}`} contentFit="cover" style={[styles.image, { backgroundColor: colors.cardMuted }]} />
      ) : null}
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text variant="heading">{d.title}</Text>
        {d.note ? (
          <Text variant="body" tone="secondary">
            {d.note}
          </Text>
        ) : null}
        {d.url ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open link, ${hostOf(d.url)}`}
            onPress={() => Linking.openURL(d.url!).catch(() => {})}
            hitSlop={8}
            style={styles.link}>
            <Text variant="caption" tone="accent" numberOfLines={1} style={{ fontWeight: '600' }}>
              {hostOf(d.url)} ↗
            </Text>
          </Pressable>
        ) : null}
        <Text variant="caption" tone="muted">
          Suggested by {by}
          {d.voteCount > 0 ? ` · Voted by ${voterNames.join(', ')}` : ''}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${d.iVoted ? 'Remove your vote for' : 'Vote for'} ${d.title}`}
            accessibilityState={{ selected: d.iVoted, disabled: readOnly }}
            disabled={readOnly}
            onPress={vote}
            style={[styles.vote, { backgroundColor: d.iVoted ? colors.votes : colors.cardMuted, borderColor: colors.votes, opacity: readOnly ? 0.6 : 1 }]}>
            <Text variant="bodyStrong" tone={d.iVoted ? 'onColor' : 'primary'}>
              {d.iVoted ? '♥ Voted' : '♡ Vote'} · {d.voteCount}
            </Text>
          </Pressable>
          {canRemove && !readOnly ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${d.title}`} onPress={confirmRemove} hitSlop={8} style={styles.remove}>
              <Text variant="caption" tone="danger" style={{ fontWeight: '600' }}>
                Remove
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { height: 160, width: '100%' },
  link: { minHeight: 24, justifyContent: 'center', alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  vote: { minHeight: MIN_TOUCH, borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  remove: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.sm },
});
