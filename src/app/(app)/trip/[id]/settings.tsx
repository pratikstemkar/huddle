import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useTripLive } from '@/lib/realtime';
import { deleteTrip, leaveTrip, removeMember, renameTrip, unlockTrip, useTrip } from '@/lib/trips';
import { MIN_TOUCH, radius, space, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function TripSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { trip, loading, refresh } = useTrip(id, session?.user.id);

  // null until the organiser types, so live updates to the name never overwrite their edit.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  // The member waiting for a "remove?" confirmation, and the one being removed right now.
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useTripLive(id, refresh);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (loading && !trip) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading settings" />
      </Screen>
    );
  }

  const isOrganiser = !!trip && trip.members.some((m) => m.user_id === session?.user.id && m.role === 'organiser');

  if (!trip) {
    return (
      <Screen footer={<Button label="Close" onPress={close} />}>
        <Text variant="title">Trip settings</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: space.md }}>
          This trip doesn&apos;t exist, or you&apos;re not a member of it.
        </Text>
      </Screen>
    );
  }

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveTrip(trip.id, session!.user.id);
      router.dismissAll();
      router.replace('/');
    } catch {
      setError("Couldn't leave the trip. Check your connection and try again.");
      setConfirmLeave(false);
    } finally {
      setLeaving(false);
    }
  };

  // Organisers can't leave (nobody would be left to run the trip); they delete it instead.
  if (!isOrganiser) {
    return (
      <Screen footer={<Button label="Close" variant="secondary" onPress={close} />}>
        <Text variant="title" style={{ marginBottom: space.xl }}>
          Trip settings
        </Text>
        <View style={[styles.danger, { borderColor: colors.line, backgroundColor: colors.card }]}>
          <Text variant="caption" tone="muted">
            Leaving removes your free days and votes. You can rejoin later with the invite code.
          </Text>
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          {confirmLeave ? (
            <View style={{ gap: space.sm }}>
              <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
                Leave &quot;{trip.name}&quot;?
              </Text>
              <Button label="Yes, leave trip" loading={leaving} color={colors.danger} onPress={leave} />
              <Button label="Stay" variant="ghost" onPress={() => setConfirmLeave(false)} />
            </View>
          ) : (
            <Button label="Leave trip" variant="secondary" onPress={() => setConfirmLeave(true)} />
          )}
        </View>
      </Screen>
    );
  }

  const fill = tripColors[trip.color] ?? tripColors.sunset;
  const name = draft ?? trip.name;
  const trimmed = name.trim();
  const dirty = trimmed !== trip.name;

  const save = async () => {
    if (!trimmed) {
      setError('Give your trip a name first.');
      return;
    }
    setSaving(true);
    try {
      await renameTrip(trip.id, trimmed);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setError("Couldn't rename the trip. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      router.dismissAll();
      router.replace('/');
    } catch {
      setError("Couldn't delete the trip. Check your connection and try again.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const unlock = async () => {
    setUnlocking(true);
    try {
      await unlockTrip(trip.id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setError("Couldn't unlock the trip. Check your connection and try again.");
      setConfirmUnlock(false);
    } finally {
      setUnlocking(false);
    }
  };

  const remove = async (userId: string) => {
    setRemoving(userId);
    try {
      await removeMember(trip.id, userId);
      setConfirmRemove(null);
      await refresh();
    } catch {
      setError("Couldn't remove that person. Check your connection and try again.");
      setConfirmRemove(null);
    } finally {
      setRemoving(null);
    }
  };

  // Organisers can remove members, but not themselves or other organisers.
  const removable = trip.members.filter((m) => m.role === 'member');

  return (
    <Screen footer={<Button label="Save name" color={fill} loading={saving} onPress={save} />}>
      <Text variant="title" style={{ marginBottom: space.xl }}>
        Trip settings
      </Text>

      <Text variant="label" style={styles.label}>
        Trip name
      </Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setDraft(t);
          if (error) setError(null);
        }}
        accessibilityLabel="Trip name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => dirty && save()}
        maxLength={60}
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
          {error}
        </Text>
      ) : null}

      {trip.status === 'locked' ? (
        <>
          <Text variant="label" style={[styles.label, { marginTop: space.xxl }]}>
            Plan
          </Text>
          <View style={[styles.danger, { borderColor: colors.line, backgroundColor: colors.card }]}>
            <Text variant="caption" tone="muted">
              Locked in by mistake, or plans changed? Unlocking clears the dates and place so everyone can mark days and vote again. Days, places and votes are kept.
            </Text>
            {confirmUnlock ? (
              <View style={{ gap: space.sm }}>
                <Text variant="bodyStrong" accessibilityLiveRegion="polite">
                  Unlock &quot;{trip.name}&quot; and re-plan?
                </Text>
                <Button label="Yes, unlock" loading={unlocking} color={fill} onPress={unlock} />
                <Button label="Keep it locked" variant="ghost" onPress={() => setConfirmUnlock(false)} />
              </View>
            ) : (
              <Button label="Unlock and re-plan" variant="secondary" onPress={() => setConfirmUnlock(true)} />
            )}
          </View>
        </>
      ) : null}

      {removable.length ? (
        <>
          <Text variant="label" style={[styles.label, { marginTop: space.xxl }]}>
            Members
          </Text>
          <View style={[styles.danger, { borderColor: colors.line, backgroundColor: colors.card }]}>
            <Text variant="caption" tone="muted">
              Removing someone clears their free days and votes. Places they suggested stay.
            </Text>
            {removable.map((m) =>
              confirmRemove === m.user_id ? (
                <View key={m.user_id} style={{ gap: space.sm }}>
                  <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
                    Remove {m.display_name} from the trip?
                  </Text>
                  <Button
                    label={`Yes, remove ${m.display_name}`}
                    loading={removing === m.user_id}
                    color={colors.danger}
                    onPress={() => remove(m.user_id)}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => setConfirmRemove(null)} />
                </View>
              ) : (
                <View key={m.user_id} style={styles.memberRow}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {m.display_name}
                  </Text>
                  <Button
                    label="Remove"
                    accessibilityLabel={`Remove ${m.display_name}`}
                    variant="ghost"
                    onPress={() => {
                      setConfirmRemove(m.user_id);
                      if (error) setError(null);
                    }}
                  />
                </View>
              ),
            )}
          </View>
        </>
      ) : null}

      <Text variant="label" style={[styles.label, { marginTop: space.xxl }]}>
        Danger zone
      </Text>
      <View style={[styles.danger, { borderColor: colors.line, backgroundColor: colors.card }]}>
        <Text variant="caption" tone="muted">
          You run this trip, so you can&apos;t leave it. Deleting removes the trip, days, places and votes for everyone. This can&apos;t be undone.
        </Text>
        {confirmDelete ? (
          <View style={{ gap: space.sm }}>
            <Text variant="bodyStrong" tone="danger" accessibilityLiveRegion="polite">
              Delete &quot;{trip.name}&quot; for everyone?
            </Text>
            <Button label="Yes, delete forever" loading={deleting} color={colors.danger} onPress={destroy} />
            <Button label="Keep trip" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </View>
        ) : (
          <Button label="Delete trip" variant="secondary" onPress={() => setConfirmDelete(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginBottom: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  danger: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
});
