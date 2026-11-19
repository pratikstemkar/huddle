import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { KnownPerson } from '@/lib/groups';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  people: KnownPerson[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** People who can't be picked, e.g. members already in the group, with the reason shown instead of the button. */
  disabled?: Map<string, string>;
  loading?: boolean;
};

/** A search box, the picked people as removable chips, and everyone you already share a trip or group with. */
export function PeoplePicker({ people, selected, onToggle, disabled, loading }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (q ? people.filter((p) => p.display_name.toLowerCase().includes(q)) : people), [people, q]);
  const chosen = people.filter((p) => selected.has(p.user_id));

  return (
    <View style={styles.root}>
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.lineStrong }]}>
        <Icon name="search" size={18} color={colors.textSecondary} />
        <TextInput
          accessibilityLabel="Search your people by name"
          placeholder="Search your people"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {chosen.length > 0 ? (
        <View style={styles.chips}>
          {chosen.map((p) => (
            <Pressable
              key={p.user_id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${p.display_name}`}
              onPress={() => onToggle(p.user_id)}
              style={[styles.chip, { backgroundColor: colors.ink }]}>
              <Avatar name={p.display_name} url={p.avatar_url} color={p.avatar_color} size={28} />
              <Text variant="calloutStrong" style={{ color: colors.onInk }}>
                {p.display_name.split(' ')[0]}
              </Text>
              <Icon name="close" size={14} color={colors.onInk} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text variant="calloutStrong">From your trips and groups</Text>
      {loading && people.length === 0 ? (
        <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          Loading your people
        </Text>
      ) : people.length === 0 ? (
        <Text variant="callout" tone="secondary">
          People you plan trips with will show up here. For anyone else, share the group’s join link once it’s made.
        </Text>
      ) : shown.length === 0 ? (
        <Text variant="callout" tone="secondary">
          No one called “{query.trim()}” in your trips or groups.
        </Text>
      ) : (
        shown.map((p) => {
          const on = selected.has(p.user_id);
          const note = disabled?.get(p.user_id);
          return (
            <View key={p.user_id} style={styles.row}>
              <Avatar name={p.display_name} url={p.avatar_url} color={p.avatar_color} size={40} />
              <View style={styles.rowText}>
                <Text variant="label" numberOfLines={1}>
                  {p.display_name}
                </Text>
                {p.source ? (
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {p.source}
                  </Text>
                ) : null}
              </View>
              {note ? (
                <Text variant="caption" tone="secondary">
                  {note}
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${on ? 'Remove' : 'Add'} ${p.display_name}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => onToggle(p.user_id)}
                  style={[styles.toggle, on ? { backgroundColor: colors.iris, borderColor: colors.iris } : { backgroundColor: colors.card, borderColor: colors.lineStrong }]}>
                  <Icon name={on ? 'check' : 'plus'} size={18} color={on ? colors.onIris : colors.text} />
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.s10 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.s14, flexDirection: 'row', alignItems: 'center', gap: space.s10 },
  searchInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingLeft: 4, paddingRight: space.sm, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  toggle: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
