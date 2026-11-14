import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CONFIRM_WORD, deleteMyAccount, describeOutcome, useDeletionPreview } from '@/lib/account';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function DeleteAccount() {
  const { colors } = useTheme();
  const { trips, error: loadError, refresh } = useDeletionPreview();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const remove = async () => {
    if (!confirmed) {
      setError(`Type ${CONFIRM_WORD} to confirm.`);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      // Signing out sends the app to sign-in; this screen unmounts with it.
      await deleteMyAccount();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
          <Button label="Delete my account" loading={deleting} onPress={remove} />
          <Button label="Keep my account" variant="ghost" onPress={() => router.back()} />
        </View>
      }>
      <Text variant="title" accessibilityRole="header">
        Delete your account
      </Text>
      <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
        This can’t be undone. Your profile, the days you marked, your votes and your trip memberships are deleted straight away. Places you
        suggested stay in their trips without your name.
      </Text>

      <Text variant="label" style={styles.label}>
        Your trips
      </Text>
      {loadError ? (
        <Text variant="caption" tone="danger">
          {loadError}
        </Text>
      ) : trips === null ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your trips" />
      ) : trips.length === 0 ? (
        <Text variant="body" tone="secondary">
          You’re not in any trips.
        </Text>
      ) : (
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {trips.map((t) => (
            <Text key={t.trip_id} variant="body">
              {describeOutcome(t)}
            </Text>
          ))}
        </View>
      )}

      <Text variant="label" style={styles.label}>
        Type {CONFIRM_WORD} to confirm
      </Text>
      <TextInput
        value={typed}
        onChangeText={(t) => {
          setTyped(t);
          if (error) setError(null);
        }}
        accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={remove}
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.xl, marginBottom: space.sm },
  list: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
});
