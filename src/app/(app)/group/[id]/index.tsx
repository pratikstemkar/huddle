import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GroupTile } from '@/components/groups/group-tile';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { hangoutStatusLine, useMyHangouts } from '@/lib/hangouts';
import {
  groupInviteLink,
  peopleCount,
  removeGroupInvite,
  removeGroupMember,
  setGroupRole,
  useGroup,
  useGroupsLive,
  type GroupDetail,
  type GroupPerson,
} from '@/lib/groups';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const COPIED_MS = 1800;

type Row = GroupPerson & { key: string; sub: string; pending: boolean; admin: boolean; me: boolean };

function rows(group: GroupDetail, me: string | undefined): Row[] {
  const members = group.members.map((m) => ({
    ...m,
    key: m.user_id,
    me: m.user_id === me,
    admin: m.role === 'admin',
    pending: false,
    sub: m.role === 'admin' ? 'Admin' : 'Member',
  }));
  const pending = group.pending.map((p) => ({ ...p, key: `invite-${p.user_id}`, me: false, admin: false, pending: true, sub: 'Invited' }));
  return [...members, ...pending];
}

export default function GroupDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const { colors } = useTheme();
  const { group, loading, error, refresh } = useGroup(id, me);
  const { hangouts: myHangouts, refresh: refreshHangouts } = useMyHangouts();
  const hangouts = myHangouts.filter((h) => h.group_id === id && h.status !== 'cancelled');
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshHangouts();
    }, [refresh, refreshHangouts]),
  );
  useGroupsLive(!!id, () => {
    refresh();
    refreshHangouts();
  });

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      after?.();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!group) {
    return (
      <Screen>
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel="Back to groups" onPress={() => router.back()} />
        </View>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.iris} accessibilityLabel="Loading the group" />
          ) : (
            <Text variant="body" tone={error ? 'danger' : 'secondary'} accessibilityLiveRegion="polite" style={styles.centerText}>
              {error ?? "This group isn't available any more."}
            </Text>
          )}
        </View>
      </Screen>
    );
  }

  const admin = group.myRole === 'admin';
  const list = rows(group, me);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(groupInviteLink(group.invite_code));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {}
  };
  const tripsLine = group.trips === 0 ? 'No trips yet' : group.trips === 1 ? '1 trip together' : `${group.trips} trips together`;

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.top}>
          <IconButton icon="back" accessibilityLabel="Back to groups" onPress={() => router.back()} />
          {admin ? <Button label="Edit" variant="outline" size="sm" accessibilityLabel="Edit group name and colour" onPress={() => router.push({ pathname: '/group/[id]/edit', params: { id: group.id } })} /> : null}
        </View>

        <View style={styles.hero}>
          <GroupTile name={group.name} color={group.color} size={64} />
          <View style={styles.heroText}>
            <Text variant="titleSm" numberOfLines={2} accessibilityRole="header">
              {group.name}
            </Text>
            <Text variant="callout" tone="secondary">
              {tripsLine}
            </Text>
          </View>
        </View>

        <View style={styles.startRow}>
          <Button label="Plan a hangout" icon="coffee" style={styles.startButton} onPress={() => router.push({ pathname: '/new-hangout', params: { group: group.id } })} />
          <Button label="Start a trip" icon="trips" variant="outline" style={styles.startButton} onPress={() => router.push({ pathname: '/new-trip', params: { group: group.id } })} />
        </View>

        {hangouts.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text variant="label" accessibilityRole="header">
              Hangouts
            </Text>
            {hangouts.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                accessibilityLabel={`${h.name}, ${hangoutStatusLine(h)}`}
                onPress={() => router.push({ pathname: '/hangout/[id]', params: { id: h.id } })}
                style={styles.hangout}>
                <View style={styles.memberText}>
                  <Text variant="label" numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {hangoutStatusLine(h)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={styles.cardHead}>
            <Text variant="label" accessibilityRole="header">
              {peopleCount(group.members.length)}
            </Text>
            {admin ? <Button label="Add" icon="plus" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/group/[id]/add', params: { id: group.id } })} /> : null}
          </View>
          {list.map((r) => {
            const menu = admin && !r.me;
            const isOpen = open === r.key;
            return (
              <View key={r.key}>
                <View style={styles.member}>
                  <Avatar name={r.display_name} url={r.avatar_url} color={r.avatar_color} size={36} />
                  <View style={styles.memberText}>
                    <Text variant="label" numberOfLines={1}>
                      {r.me ? `${r.display_name} (you)` : r.display_name}
                    </Text>
                    <Text variant="caption" style={r.pending ? { color: colors.owe } : undefined} tone={r.pending ? undefined : 'secondary'}>
                      {r.sub}
                    </Text>
                  </View>
                  {menu ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${r.display_name}`}
                      accessibilityState={{ expanded: isOpen }}
                      onPress={() => setOpen(isOpen ? null : r.key)}
                      style={styles.menuButton}>
                      <Icon name="more" size={20} color={colors.text} />
                    </Pressable>
                  ) : null}
                </View>
                {isOpen ? (
                  <View style={styles.actions}>
                    {r.pending ? (
                      <Button
                        label="Cancel invite"
                        variant="outline"
                        size="sm"
                        style={styles.action}
                        accessibilityLabel={`Cancel invite for ${r.display_name}`}
                        onPress={() => run(() => removeGroupInvite(group.id, r.user_id), () => setOpen(null))}
                      />
                    ) : (
                      <>
                        <Button
                          label={r.admin ? 'Remove admin' : 'Make admin'}
                          variant="outline"
                          size="sm"
                          style={styles.action}
                          accessibilityLabel={`${r.admin ? 'Remove admin from' : 'Make admin'} ${r.display_name}`}
                          onPress={() => run(() => setGroupRole(group.id, r.user_id, r.admin ? 'member' : 'admin'), () => setOpen(null))}
                        />
                        {!r.admin ? (
                          <Button
                            label="Remove"
                            variant="outline"
                            size="sm"
                            style={styles.action}
                            accessibilityLabel={`Remove ${r.display_name}`}
                            onPress={() => run(() => removeGroupMember(group.id, r.user_id), () => setOpen(null))}
                          />
                        ) : null}
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={[styles.link, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={styles.memberText}>
            <Text variant="label">Join link</Text>
            <Text variant="caption" tone="secondary">
              For friends not on Huddle yet
            </Text>
          </View>
          <Button label={copied ? 'Copied' : 'Copy link'} variant="ink" size="sm" icon={copied ? 'check' : 'copy'} onPress={copy} />
        </View>

        {actionError ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {actionError}
          </Text>
        ) : null}

        {confirmLeave ? (
          <View style={[styles.link, { backgroundColor: colors.card, borderColor: colors.danger }]}>
            <Text variant="callout" style={styles.memberText}>
              Leave {group.name}? You can rejoin with the link.
            </Text>
            <Button label="Cancel" variant="outline" size="sm" onPress={() => setConfirmLeave(false)} />
            <Button
              label="Leave"
              size="sm"
              color={colors.danger}
              loading={busy}
              accessibilityLabel={`Leave ${group.name}`}
              onPress={() => me && run(() => removeGroupMember(group.id, me), () => router.dismissTo('/groups'))}
            />
          </View>
        ) : (
          <Button label="Leave group" variant="ghost" onPress={() => setConfirmLeave(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  centerText: { textAlign: 'center' },
  startRow: { flexDirection: 'row', gap: space.sm },
  startButton: { flex: 1 },
  hangout: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.s14 },
  heroText: { flex: 1, minWidth: 0, gap: space.xxs },
  card: { borderWidth: 1, borderRadius: radius.card, paddingVertical: space.sm, paddingLeft: space.lg, paddingRight: space.sm },
  cardHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  member: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md },
  memberText: { flex: 1, minWidth: 0, gap: 1 },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, paddingLeft: 48, paddingBottom: space.s10 },
  action: { flex: 1 },
  link: { borderWidth: 1, borderRadius: radius.lg, paddingVertical: space.sm, paddingLeft: space.lg, paddingRight: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
