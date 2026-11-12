import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { createTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function NewTrip() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TripColor>('sunset');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your trip a name first.');
      return;
    }
    setSaving(true);
    try {
      await createTrip(trimmed, color);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("Couldn't create the trip. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button label="Create trip" color={tripColors[color]} loading={saving} onPress={submit} />}>
      <Text variant="title" style={{ marginBottom: space.xl }}>
        New trip
      </Text>

      <View style={[styles.preview, { backgroundColor: tripColors[color] }]}>
        <Text variant="title" tone="onColor" numberOfLines={2}>
          {name.trim() || 'Goa in March'}
        </Text>
      </View>

      <Text variant="label" style={styles.label}>
        Trip name
      </Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError(null);
        }}
        placeholder="Goa in March"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Trip name"
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={60}
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
          {error}
        </Text>
      ) : null}

      <Text variant="label" style={styles.label}>
        Trip colour
      </Text>
      <ColorSwatches value={color} onChange={setColor} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.lg, padding: space.xl, minHeight: 120, justifyContent: 'flex-end' },
  label: { marginTop: space.xl, marginBottom: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
});
