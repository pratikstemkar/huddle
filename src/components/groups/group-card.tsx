import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { groupSub, type GroupCard as GroupCardData } from '@/lib/groups';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { GroupTile } from './group-tile';

/** One group on the Groups tab: tap the top to open it, or plan a hangout or start a trip with it from the buttons below. */
export function GroupCard({ group }: { group: GroupCardData }) {
  const { colors } = useTheme();
  const sub = groupSub(group.members, group.trips);
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${sub}`}
        accessibilityHint="Opens the group"
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
        style={styles.top}>
        <GroupTile name={group.name} color={group.color} />
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text variant="cardTitle" numberOfLines={1} style={styles.name}>
              {group.name}
            </Text>
            {group.justJoined ? <Badge label="Just joined" tone="neutral" /> : null}
          </View>
          <View style={styles.faces}>
            <AvatarStack
              size={22}
              overlap={6}
              ring={colors.card}
              people={group.faces.map((f) => ({ name: f.display_name, url: f.avatar_url, color: f.avatar_color }))}
            />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.sub}>
              {sub}
            </Text>
          </View>
        </View>
        <Icon name="chevronRight" size={20} color={colors.textSecondary} />
      </Pressable>
      <View style={styles.actions}>
        <Button
          label="Hangout"
          variant="secondary"
          size="sm"
          icon="coffee"
          style={styles.action}
          accessibilityLabel={`Plan a hangout with ${group.name}`}
          onPress={() => router.push({ pathname: '/new-hangout', params: { group: group.id } })}
        />
        <Button
          label="Trip"
          variant="secondary"
          size="sm"
          icon="trips"
          style={styles.action}
          accessibilityLabel={`Start a trip with ${group.name}`}
          onPress={() => router.push({ pathname: '/new-trip', params: { group: group.id } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.md, gap: space.s10 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { flex: 1, minWidth: 0, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1 },
  faces: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sub: { flex: 1, paddingLeft: space.xs },
});
