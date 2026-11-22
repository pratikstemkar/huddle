import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { PlacePhoto } from '@/components/place-photo';
import { useConfirm } from '@/components/ui/confirm-sheet';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { hostOf, type Destination } from '@/lib/destinations';
import { radius, space, type } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

type Props = {
  destination: Destination;
  /** Display name per user id, for "suggested by" and voters. */
  names: Map<string, string>;
  memberCount: number;
  leading: boolean;
  readOnly: boolean;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
};

const THUMB = 56;

export function PlaceVoteCard({ destination: d, names, memberCount, leading, readOnly, canRemove, onVote, onRemove }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const by = (d.created_by && names.get(d.created_by)) || 'Someone';
  const voterNames = d.voters.map((u) => names.get(u) ?? 'Someone');
  const hasPhoto = !!d.photoUrl || !!d.image_path;

  const vote = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onVote();
  };

  const confirmRemove = async () => {
    if (await confirm({ title: `Remove "${d.title}"?`, message: 'Its votes go too.', confirmLabel: 'Remove', destructive: true })) onRemove();
  };

  return (
    <Animated.View
      layout={reduced ? undefined : LinearTransition.duration(220)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${d.title}, ${d.voteCount} ${d.voteCount === 1 ? 'vote' : 'votes'}`}
          accessibilityHint={open ? 'Hides the details' : 'Shows the details'}
          aria-expanded={open}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}>
          {hasPhoto && !open ? (
            <PlacePhoto place={d} accessibilityLabel={`Photo of ${d.title}`} style={[styles.thumb, { backgroundColor: colors.track }]} />
          ) : null}
          <View style={styles.text}>
            <View style={styles.titleRow}>
              <Text variant="cardTitle" numberOfLines={open ? undefined : 1} style={styles.shrink}>
                {d.title}
              </Text>
              {leading ? <Badge label="Leading" tone="beakSm" /> : null}
            </View>
            <Text variant="caption" tone="secondary" numberOfLines={open ? undefined : 1}>
              Suggested by {by}
              {d.note ? ` · ${d.note}` : ''}
            </Text>
            <ProgressBar value={memberCount > 0 ? d.voteCount / memberCount : 0} accessibilityLabel={`${d.voteCount} of ${memberCount} voted for ${d.title}`} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${d.iVoted ? 'Remove your vote for' : 'Vote for'} ${d.title}`}
          aria-selected={d.iVoted}
          aria-disabled={readOnly}
          disabled={readOnly}
          onPress={vote}
          style={({ pressed }) => [
            styles.vote,
            { backgroundColor: d.iVoted ? colors.iris : colors.tint.vote, opacity: readOnly ? 0.6 : pressed ? 0.85 : 1 },
          ]}>
          <Icon name="vote" size={20} strokeWidth={2.4} color={d.iVoted ? colors.onIris : colors.irisText} />
          <Text style={[type.numberXs, { color: d.iVoted ? colors.onIris : colors.irisText }]}>{d.voteCount}</Text>
        </Pressable>
      </View>

      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} style={styles.details}>
          {hasPhoto ? <PlacePhoto place={d} accessibilityLabel={`Photo of ${d.title}`} style={[styles.photo, { backgroundColor: colors.track }]} /> : null}
          {d.url ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open link, ${hostOf(d.url)}`}
              onPress={() => Linking.openURL(d.url!).catch(() => {})}
              hitSlop={8}
              style={styles.link}>
              <Text variant="calloutStrong" tone="iris" numberOfLines={1}>
                {hostOf(d.url)} ↗
              </Text>
            </Pressable>
          ) : null}
          <Text variant="caption" tone="secondary">
            {d.voteCount > 0 ? `Voted by ${voterNames.join(', ')}` : 'No votes yet'}
          </Text>
          {canRemove && !readOnly ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${d.title}`} onPress={confirmRemove} hitSlop={8} style={styles.remove}>
              <Text variant="calloutStrong" tone="danger">
                Remove
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.s14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s14 },
  body: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s14 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md },
  text: { flex: 1, minWidth: 0, gap: space.s6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  vote: { width: 56, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
  details: { gap: space.md },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  link: { minHeight: 24, justifyContent: 'center', alignSelf: 'flex-start' },
  remove: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
