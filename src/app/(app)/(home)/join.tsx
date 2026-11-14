import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { joinTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function JoinTrip() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(typeof params.code === 'string' ? params.code : '');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter the invite code your friend sent you.');
      return;
    }
    setJoining(true);
    try {
      const tripId = await joinTrip(trimmed);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Replace (not dismiss + push): works whether the sheet was opened from home or straight from a link.
      router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join the trip.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen footer={<Button label="Join trip" loading={joining} onPress={submit} />}>
      <Text variant="title" style={{ marginBottom: space.sm }}>
        Join a trip
      </Text>
      <Text variant="body" tone="secondary">
        Enter the invite code from the person who started the trip.
      </Text>

      <Text variant="label" style={styles.label}>
        Invite code
      </Text>
      <TextInput
        value={code}
        onChangeText={(t) => {
          setCode(t);
          if (error) setError(null);
        }}
        placeholder="e.g. a1b2c3d4"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Invite code"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        maxLength={32}
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.xl, marginBottom: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17, letterSpacing: 1 },
});
