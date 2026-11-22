import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { GroupPerson } from '@/lib/groups';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  people: GroupPerson[];
  /** People left out. Everyone else is invited. */
  off: ReadonlySet<string>;
  onToggle: (userId: string) => void;
};

/** A grid of faces: tap one to leave them out (or back in). The ring and tick mark who is invited. */
export function MemberGrid({ people, off, onToggle }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {people.map((m) => {
        const on = !off.has(m.user_id);
        return (
          <Pressable
            key={m.user_id}
            accessibilityRole="button"
            accessibilityLabel={`${on ? 'Don’t invite' : 'Invite'} ${m.display_name}`}
            aria-selected={on}
            onPress={() => onToggle(m.user_id)}
            style={[styles.cell, !on && { opacity: 0.55 }]}>
            <View style={[styles.ring, { borderColor: on ? colors.iris : 'transparent' }]}>
              <Avatar name={m.display_name} url={m.avatar_url} color={m.avatar_color} size={52} />
              {on ? (
                <View style={[styles.tick, { backgroundColor: colors.iris, borderColor: colors.bg }]}>
                  <Icon name="check" size={12} color={colors.onIris} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <Text variant="caption" numberOfLines={1} style={styles.name}>
              {m.display_name.split(' ')[0]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '25%', alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  ring: { borderWidth: 2, borderRadius: 30, padding: 2 },
  tick: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { maxWidth: 76 },
});
