import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CONFIRM_WORD, deleteMyAccount, describeOutcome, useDeletionPreview } from '@/lib/account';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Problem = { message: string; field: boolean };

export default function DeleteAccount() {
  const { colors } = useTheme();
  const { trips, error: loadError, refresh } = useDeletionPreview();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const remove = async () => {
    if (!confirmed) {
      setProblem({ message: `Type ${CONFIRM_WORD} to confirm.`, field: true });
      return;
    }
    setDeleting(true);
    setProblem(null);
    try {
      // Signing out sends the app to sign-in; this screen unmounts with it.
      await deleteMyAccount();
    } catch (e) {
      setProblem({ message: (e as Error).message, field: false });
      setDeleting(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {problem && !problem.field ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {problem.message}
            </Text>
          ) : null}
          <Button label="Delete my account" loading={deleting} onPress={remove} style={{ backgroundColor: colors.danger }} />
          <Button label="Keep my account" variant="ghost" onPress={() => router.back()} />
        </View>
      }>
      <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} />
      <View style={styles.header}>
        <Text variant="title" style={{ flex: 1 }}>
          Delete your account
        </Text>
        <Pip mood="hmm" size={76} />
      </View>
      <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
        This can’t be undone. Your profile, the days you marked, your votes and your trip memberships are deleted straight away. Places you
        suggested stay in their trips without your name.
      </Text>

      <Card style={styles.trips}>
        <Text variant="label">Your trips</Text>
        {loadError ? (
          <Text variant="caption" tone="danger">
            {loadError}
          </Text>
        ) : trips === null ? (
          <ActivityIndicator color={colors.iris} accessibilityLabel="Loading your trips" />
        ) : trips.length === 0 ? (
          <Text variant="body" tone="secondary">
            You’re not in any trips.
          </Text>
        ) : (
          trips.map((t) => (
            <Text key={t.trip_id} variant="body">
              {describeOutcome(t)}
            </Text>
          ))
        )}
      </Card>

      <Input
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={typed}
        error={problem?.field ? problem.message : null}
        onChangeText={(t) => {
          setTyped(t);
          if (problem) setProblem(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={remove}
        containerStyle={{ marginTop: space.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.lg },
  trips: { marginTop: space.xl, gap: space.sm, padding: space.s20 },
});
