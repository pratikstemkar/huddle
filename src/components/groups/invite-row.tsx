import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { peopleCount, type GroupInvite } from '@/lib/groups';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { GroupTile } from './group-tile';

/** "Tanvi added you to Book club": join or decline. */
export function InviteRow({ invite, busy, onJoin, onDecline }: { invite: GroupInvite; busy: boolean; onJoin: () => void; onDecline: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.beak }]}>
      <GroupTile name={invite.group_name} color={invite.group_color} size={40} />
      <View style={styles.body}>
        <Text variant="callout" numberOfLines={2}>
          <Text variant="calloutStrong">{invite.from}</Text> added you to {invite.group_name}
        </Text>
        <Text variant="caption" tone="secondary">
          Group · {peopleCount(invite.members)}
        </Text>
      </View>
      <IconButton icon="close" accessibilityLabel={`Decline ${invite.group_name}`} onPress={busy ? undefined : onDecline} />
      <Button label="Join" size="sm" loading={busy} accessibilityLabel={`Join ${invite.group_name}`} onPress={onJoin} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 2, borderRadius: radius.xl, paddingVertical: space.s10, paddingLeft: space.md, paddingRight: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.s10 },
  body: { flex: 1, minWidth: 0, gap: space.xxs },
});
