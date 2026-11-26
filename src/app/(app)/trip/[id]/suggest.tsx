import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { SheetHeader } from '@/components/trip/sheet-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { SpeechCard } from '@/components/ui/speech-card';
import { Text } from '@/components/ui/text';
import { posthog } from '@/config/posthog';
import { normaliseUrl, suggestDestination } from '@/lib/destinations';
import { PHOTO_HEIGHT, PHOTO_WIDTH, PhotoPermissionError, pickPhoto, preparePhoto, type PreparedPhoto } from '@/lib/place-photo';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Errors = { title?: string; url?: string; photo?: string; form?: string };

export default function SuggestPlace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const clear = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (id) router.replace({ pathname: '/trip/[id]', params: { id } });
    else router.replace('/');
  };

  const addPhoto = async (from: 'library' | 'camera') => {
    clear('photo');
    try {
      const picked = await pickPhoto(from);
      if (!picked) return;
      setPreparing(true);
      setPhoto(await preparePhoto(picked));
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        photo: e instanceof PhotoPermissionError ? 'Allow camera access in Settings to take a photo.' : "Couldn't use that photo. Try another one.",
      }));
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    const next: Errors = {};
    const trimmed = title.trim();
    const link = url.trim() ? normaliseUrl(url) : null;
    if (!trimmed) next.title = 'Give the place a name first.';
    if (url.trim() && !link) next.url = "That doesn't look like a web link.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !id || preparing) return;

    setSaving(true);
    try {
      await suggestDestination(id, { title: trimmed, note: note.trim(), url: link ?? undefined, photoUri: photo?.uri });
      posthog?.capture('destination_suggested', {
        has_link: Boolean(link),
        has_note: Boolean(note.trim()),
        has_photo: Boolean(photo),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setErrors({ form: "Couldn't add that place. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const dashed = { borderColor: colors.dashed };

  return (
    <Screen contentStyle={styles.content} footer={<Button label={saving && photo ? 'Uploading photo…' : 'Add place'} loading={saving} onPress={submit} />}>
      <SheetHeader title="Suggest a place" onClose={close} />

      <Input
        label="Name"
        accessibilityLabel="Place name"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          clear('title');
        }}
        placeholder="Palolem Beach"
        maxLength={80}
        returnKeyType="next"
        error={errors.title}
      />

      <Input
        label="Note (optional)"
        accessibilityLabel="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Why this place?"
        maxLength={500}
        multiline
        style={styles.multiline}
      />

      <Input
        label="Link (optional)"
        accessibilityLabel="Link"
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          clear('url');
        }}
        placeholder="https://…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={errors.url}
      />

      <View style={{ gap: space.sm }}>
        <Text variant="calloutStrong">Photo (optional)</Text>
        {photo ? (
          <View style={{ gap: space.sm }}>
            <Image source={{ uri: photo.uri }} accessibilityLabel="Photo preview" contentFit="cover" style={[styles.box, { backgroundColor: colors.track }]} />
            <View style={styles.row}>
              <Chip label="Change photo" onPress={() => addPhoto('library')} />
              <Chip label="Remove photo" onPress={() => setPhoto(null)} />
            </View>
          </View>
        ) : preparing ? (
          <View style={[styles.box, styles.dashed, dashed]}>
            <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite">
              Preparing photo…
            </Text>
          </View>
        ) : (
          <View style={[styles.box, styles.dashed, dashed]}>
            <Text variant="label" tone="iris">
              Add a photo
            </Text>
            <View style={styles.row}>
              <Button label="Choose photo" icon="photos" variant="outline" size="sm" onPress={() => addPhoto('library')} />
              {Platform.OS !== 'web' ? <Button label="Take photo" icon="camera" variant="outline" size="sm" onPress={() => addPhoto('camera')} /> : null}
            </View>
          </View>
        )}
        {errors.photo ? <FieldError text={errors.photo} /> : null}
      </View>

      <SpeechCard>A photo helps people vote.</SpeechCard>

      {errors.form ? <FieldError text={errors.form} /> : null}
    </Screen>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.s20 },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  // Same shape as the stored photo, so the preview shows exactly what everyone will see.
  box: { width: '100%', aspectRatio: PHOTO_WIDTH / PHOTO_HEIGHT, borderRadius: radius.card },
  dashed: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
