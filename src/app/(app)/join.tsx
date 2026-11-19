import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { joinGroup } from '@/lib/groups';
import { joinTrip, parseInviteCode } from '@/lib/trips';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function JoinTrip() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const linked = typeof params.code === 'string' ? params.code : '';
  const [code, setCode] = useState(linked);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // The tab stays mounted, so a later invite link (`/join?code=`) has to refill the field.
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    if (linked) setCode(linked);
  }

  const edit = (t: string) => {
    setCode(t);
    if (error) setError(null);
  };

  const paste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) edit(parseInviteCode(text));
    } catch {}
  };

  const submit = async () => {
    const parsed = parseInviteCode(code);
    if (!parsed) {
      setError('Enter the invite code your friend sent you.');
      return;
    }
    setJoining(true);
    try {
      let tripId: string | null = null;
      let groupId: string | null = null;
      try {
        tripId = await joinTrip(parsed);
      } catch (e) {
        // Not a trip's code: it may be a group's join link.
        if (!(e instanceof Error) || !/doesn't match/i.test(e.message)) throw e;
        try {
          groupId = await joinGroup(parsed);
        } catch (g) {
          if (g instanceof Error && /doesn't match/i.test(g.message)) throw new Error("That code doesn't match a trip or group. Check it and try again.");
          throw g;
        }
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode('');
      // Replace this screen so Back from the trip or group returns to the tabs, not to a used code.
      if (tripId) router.replace({ pathname: '/trip/[id]', params: { id: tripId } });
      else if (groupId) router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join the trip.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen>
      <View style={styles.page}>
        <IconButton icon="back" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back} />
        <View style={styles.header}>
          <Text variant="callout" tone="secondary">
            Got a code?
          </Text>
          <Text variant="title">Join a trip</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Pip mood="hello" size={96} />
          <Text variant="callout" tone="secondary" style={styles.centered}>
            Paste the code or link your friend sent, for a trip or a group.
          </Text>
          <View style={styles.field}>
            <Input
              label="Invite code"
              value={code}
              onChangeText={edit}
              placeholder="e.g. a1b2c3d4"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={submit}
              maxLength={200}
              style={[styles.input, error ? { borderWidth: 2, borderColor: colors.danger, paddingLeft: 17 } : null]}
            />
            <Chip label="Paste" accessibilityLabel="Paste invite code" onPress={paste} style={styles.paste} />
          </View>
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button label="Join trip" loading={joining} onPress={submit} style={styles.stretch} />
        </View>

        <SpeechCard>A trip&apos;s code is under the + next to everyone&apos;s faces. A group&apos;s join link is on its details screen.</SpeechCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s18 },
  back: { alignSelf: 'flex-start' },
  header: { gap: space.xxs },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: space.s20, gap: space.s14, alignItems: 'center' },
  centered: { textAlign: 'center' },
  field: { alignSelf: 'stretch' },
  input: { letterSpacing: 1, paddingRight: 96 },
  paste: { position: 'absolute', right: 6, bottom: 6, minHeight: 44 },
  error: { alignSelf: 'stretch' },
  stretch: { alignSelf: 'stretch' },
});
