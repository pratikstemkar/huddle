import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { displayName, useAuth } from '@/lib/auth';
import { MAX_NAME, updateProfile, useMyProfile } from '@/lib/profile';
import { radius, space, toTripColor, tripTints, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function Row({ label, onPress, danger, hint, last }: { label: string; onPress: () => void; danger?: boolean; hint?: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }, pressed && { opacity: 0.7 }]}>
      <Text variant="label" tone={danger ? 'danger' : 'primary'} style={styles.rowLabel}>
        {label}
      </Text>
      <Icon name="chevronRight" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const { profile, loading, refresh } = useMyProfile(userId);

  // Drafts stay null until edited, so a reload never overwrites what you typed.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState<TripColor | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (loading && !profile) {
    return (
      <Screen withNav scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.iris} accessibilityLabel="Loading your profile" />
      </Screen>
    );
  }

  const name = nameDraft ?? profile?.display_name ?? displayName(session);
  const stored = profile?.avatar_color;
  const color = colorDraft ?? (stored ? toTripColor(stored) : null);
  const photo = dropPhoto ? null : (profile?.avatar_url ?? null);
  const trimmed = name.trim();
  const version = Constants.expoConfig?.version;

  const save = async () => {
    if (!userId) return;
    if (!trimmed) {
      setError('Add your name first.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(userId, {
        display_name: trimmed,
        ...(color ? { avatar_color: color } : {}),
        ...(dropPhoto ? { avatar_url: null } : {}),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      await refresh();
      setNameDraft(null);
      setColorDraft(null);
      setDropPhoto(false);
    } catch {
      setError("Couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen withNav>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            Signed in as {session?.user.email ?? displayName(session)}
          </Text>
          <Text variant="title">You</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={styles.preview} accessible accessibilityLabel={`Avatar preview, ${trimmed || 'no name yet'}`}>
            <Avatar name={trimmed || '?'} url={photo} color={color} fallbackColor={tripTints.blush} size={88} />
            <Text variant="caption" tone="secondary">
              This is how your trip-mates see you.
            </Text>
          </View>

          <Input
            label="Your name"
            value={name}
            onChangeText={(t) => {
              setNameDraft(t);
              setSaved(false);
              if (error) setError(null);
            }}
            error={error}
            placeholder="Your name"
            returnKeyType="done"
            onSubmitEditing={save}
            maxLength={MAX_NAME}
            autoComplete="name"
          />

          <View style={styles.group}>
            <Text variant="calloutStrong">Avatar colour</Text>
            {photo ? (
              <>
                <Text variant="caption" tone="secondary">
                  You&apos;re using the photo from your sign-in. Switch to your initial to pick a colour.
                </Text>
                <Button label="Use my initial instead" variant="outline" size="md" onPress={() => setDropPhoto(true)} />
              </>
            ) : (
              <ColorSwatches
                value={color}
                onChange={(c) => {
                  setColorDraft(c);
                  setSaved(false);
                }}
              />
            )}
          </View>

          <Button label="Save profile" loading={saving} onPress={save} />
          {saved ? (
            <Text variant="caption" tone="positive" accessibilityLiveRegion="polite" style={styles.centered}>
              Saved
            </Text>
          ) : null}
        </View>

        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Row label="Privacy policy" onPress={() => router.push('/privacy')} />
          <Row label="Delete account" danger hint="Explains what happens to your trips first" onPress={() => router.push('/delete-account')} />
          <Row label="Sign out" onPress={signOut} last />
        </View>

        {version ? (
          <Text variant="caption" tone="secondary" style={styles.centered}>
            Huddle {version}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { gap: space.s18 },
  header: { gap: space.xxs },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: space.s20, gap: space.lg },
  preview: { alignItems: 'center', gap: space.sm },
  group: { gap: space.s10 },
  list: { borderWidth: 1, borderRadius: radius.card, paddingHorizontal: space.lg },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowLabel: { flex: 1 },
  centered: { textAlign: 'center' },
});
