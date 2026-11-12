import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ColorSwatches } from '@/components/color-swatches';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { displayName, useAuth } from '@/lib/auth';
import { MAX_NAME, updateProfile, useMyProfile } from '@/lib/profile';
import { MIN_TOUCH, radius, space, type TripColor } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

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

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (loading && !profile) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your profile" />
      </Screen>
    );
  }

  const name = nameDraft ?? profile?.display_name ?? displayName(session);
  const color = colorDraft ?? profile?.avatar_color ?? null;
  const photo = dropPhoto ? null : (profile?.avatar_url ?? null);
  const trimmed = name.trim();

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
      close();
    } catch {
      setError("Couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button label="Save profile" loading={saving} onPress={save} />}>
      <Text variant="title" style={{ marginBottom: space.xl }}>
        Your profile
      </Text>

      <View style={styles.preview} accessible accessibilityLabel={`Avatar preview, ${trimmed || 'no name yet'}`}>
        <Avatar name={trimmed || '?'} url={photo} color={color} fallbackColor={colors.celebrate} size={88} />
        <Text variant="caption" tone="secondary">
          This is how your trip-mates see you.
        </Text>
      </View>

      <Text variant="label" style={styles.label}>
        Your name
      </Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setNameDraft(t);
          if (error) setError(null);
        }}
        accessibilityLabel="Your name"
        placeholder="Your name"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={save}
        maxLength={MAX_NAME}
        autoComplete="name"
        style={[styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }]}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
          {error}
        </Text>
      ) : null}

      <Text variant="label" style={styles.label}>
        Avatar colour
      </Text>
      {photo ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="muted">
            You&apos;re using the photo from your sign-in. Switch to your initial to pick a colour.
          </Text>
          <Button label="Use my initial instead" variant="secondary" onPress={() => setDropPhoto(true)} />
        </View>
      ) : (
        <ColorSwatches value={color} onChange={setColorDraft} />
      )}

      <View style={[styles.signOut, { borderColor: colors.line, backgroundColor: colors.card }]}>
        <Text variant="caption" tone="muted">
          Signed in as {session?.user.email ?? displayName(session)}
        </Text>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { alignItems: 'center', gap: space.sm },
  label: { marginTop: space.xl, marginBottom: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
  signOut: { marginTop: space.xxl, borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
});
