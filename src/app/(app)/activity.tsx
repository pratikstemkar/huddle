import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import type { IconName } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { timeAgo, useActivity, type ActivityItem, type NotificationKind } from '@/lib/activity';
import { useAuth } from '@/lib/auth';
import { openSystemSettings, pushPermission, registerForPush, safeAppPath, type PushPermission } from '@/lib/notifications';
import type { TintArea } from '@/theme/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const KIND_ICON: Record<NotificationKind, { icon: IconName; area: TintArea }> = {
  trip_invite: { icon: 'invites', area: 'trip' },
  group_invite: { icon: 'groups', area: 'trip' },
  hangout_invite: { icon: 'clock', area: 'plan' },
  trip_locked: { icon: 'lock', area: 'split' },
  hangout_locked: { icon: 'clock', area: 'split' },
  hangout_cancelled: { icon: 'close', area: 'photos' },
  nudge_days: { icon: 'plan', area: 'vote' },
  nudge_vote: { icon: 'vote', area: 'vote' },
  trip_joined: { icon: 'groups', area: 'trip' },
};

function Row({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const { colors } = useTheme();
  const unread = !item.read_at;
  const look = KIND_ICON[item.kind] ?? { icon: 'bell', area: 'vote' };
  const when = timeAgo(item.created_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.body.replace(/\.$/, '')}. ${when}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: unread ? colors.card : 'transparent', borderColor: unread ? colors.line : 'transparent' },
        pressed && { opacity: 0.7 },
      ]}>
      <IconTile area={look.area} icon={look.icon} />
      <View style={styles.rowBody}>
        <Text variant={unread ? 'calloutStrong' : 'callout'} numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      <View style={styles.rowEnd} aria-hidden>
        <Text variant="caption" tone="secondary">
          {when}
        </Text>
        {unread ? <View style={[styles.dot, { backgroundColor: colors.iris }]} /> : null}
      </View>
    </Pressable>
  );
}

/** Offers push on a phone that hasn't got it; says nothing on web or once it's on. */
function PushCard() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  useEffect(() => {
    pushPermission().then(setPermission, () => setPermission('unsupported'));
  }, []);
  if (permission !== 'undetermined' && permission !== 'denied') return null;
  const denied = permission === 'denied';
  return (
    <Card style={styles.pushCard}>
      <Text variant="calloutStrong">Get these on your phone</Text>
      <Text variant="caption" tone="secondary">
        {denied
          ? 'Notifications are off for Huddle. Turn them on in Settings to hear when a trip is locked or someone nudges you.'
          : 'Hear when a trip is locked, someone invites you, or the group is waiting on you.'}
      </Text>
      <Button
        label={denied ? 'Open Settings' : 'Turn on notifications'}
        variant="outline"
        size="md"
        onPress={async () => {
          if (denied) openSystemSettings();
          else setPermission(await registerForPush({ prompt: true }));
        }}
      />
    </Card>
  );
}

export default function Activity() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const { items, unread, loading, error, refresh, markRead } = useActivity(session?.user.id);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const open = (item: ActivityItem) => {
    if (!item.read_at) markRead([item.id]).catch(() => {});
    const path = safeAppPath(item.url);
    if (path) router.push(path as Href);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        {unread > 0 ? <Button label="Mark all read" variant="ghost" size="sm" onPress={() => markRead().catch(() => {})} /> : null}
      </View>
      <Text variant="title" style={styles.title}>
        Activity
      </Text>

      <View style={styles.list}>
        <PushCard />
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.iris} accessibilityLabel="Loading your activity" style={styles.loading} />
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Pip mood="snooze" size={88} />
            <Text variant="callout" tone="secondary" style={styles.emptyText}>
              Nothing yet. Invites, nudges and locked plans show up here.
            </Text>
          </View>
        ) : (
          items.map((item) => <Row key={item.id} item={item} onPress={() => open(item)} />)
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: space.md },
  list: { marginTop: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  rowBody: { flex: 1, minWidth: 0, gap: space.xxs },
  rowEnd: { alignItems: 'flex-end', gap: space.s6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pushCard: { gap: space.sm, marginBottom: space.sm },
  loading: { marginTop: space.xxxl },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  emptyText: { textAlign: 'center' },
});
