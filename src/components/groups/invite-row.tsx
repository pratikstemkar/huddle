import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { peopleCount, type GroupInvite } from '@/lib/groups';
import type { TripInvite } from '@/lib/trip-invites';
import { onTripColor, radius, space, tripColors } from '@/theme/tokens';
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
  tripTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

/** "Kabir invited you to Winter workation": join or decline. Trips carry their colour and a trip glyph. */
export function TripInviteRow({ invite, busy, onJoin, onDecline }: { invite: TripInvite; busy: boolean; onJoin: () => void; onDecline: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.beak }]}>
      <View aria-hidden style={[styles.tripTile, { backgroundColor: tripColors[invite.trip_color] }]}>
        <Icon name="trips" size={20} color={onTripColor[invite.trip_color]} />
      </View>
      <View style={styles.body}>
        <Text variant="callout" numberOfLines={2}>
          <Text variant="calloutStrong">{invite.from}</Text> invited you to {invite.trip_name}
        </Text>
        <Text variant="caption" tone="secondary">
          Trip · {invite.datesSet ? 'dates set' : 'dates still open'}
        </Text>
      </View>
      <IconButton icon="close" accessibilityLabel={`Decline ${invite.trip_name}`} onPress={busy ? undefined : onDecline} />
      <Button label="Join" size="sm" loading={busy} accessibilityLabel={`Join ${invite.trip_name}`} onPress={onJoin} />
    </View>
  );
}
