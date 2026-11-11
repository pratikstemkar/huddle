import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { normaliseUrl, suggestDestination } from '@/lib/destinations';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Errors = { title?: string; url?: string; image?: string; form?: string };

export default function SuggestPlace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const previewUrl = normaliseUrl(imageUrl);

  const submit = async () => {
    const next: Errors = {};
    const trimmed = title.trim();
    const link = url.trim() ? normaliseUrl(url) : null;
    const image = imageUrl.trim() ? normaliseUrl(imageUrl) : null;
    if (!trimmed) next.title = 'Give the place a name first.';
    if (url.trim() && !link) next.url = "That doesn't look like a web link.";
    if (imageUrl.trim() && !image) next.image = "That doesn't look like a web link.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !id) return;

    setSaving(true);
    try {
      await suggestDestination(id, { title: trimmed, note: note.trim(), url: link ?? undefined, imageUrl: image ?? undefined });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setErrors({ form: "Couldn't add that place. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const input = (error?: string) => [styles.input, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.line, color: colors.text }];
  const clear = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  return (
    <Screen footer={<Button label="Add place" loading={saving} onPress={submit} />}>
      <Text variant="title" style={{ marginBottom: space.md }}>
        Suggest a place
      </Text>

      <Text variant="label" style={styles.label}>
        Name
      </Text>
      <TextInput
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          clear('title');
        }}
        placeholder="Palolem Beach"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Place name"
        maxLength={80}
        returnKeyType="next"
        style={input(errors.title)}
      />
      {errors.title ? <FieldError text={errors.title} /> : null}

      <Text variant="label" style={styles.label}>
        Note (optional)
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Why this place?"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Note"
        maxLength={500}
        multiline
        style={[...input(), styles.multiline]}
      />

      <Text variant="label" style={styles.label}>
        Link (optional)
      </Text>
      <TextInput
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          clear('url');
        }}
        placeholder="https://…"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Link"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={input(errors.url)}
      />
      {errors.url ? <FieldError text={errors.url} /> : null}

      <Text variant="label" style={styles.label}>
        Image link (optional)
      </Text>
      <TextInput
        value={imageUrl}
        onChangeText={(t) => {
          setImageUrl(t);
          clear('image');
        }}
        placeholder="https://…/photo.jpg"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Image link"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={input(errors.image)}
      />
      {errors.image ? <FieldError text={errors.image} /> : null}
      {previewUrl ? (
        <Image source={{ uri: previewUrl }} accessibilityLabel="Image preview" contentFit="cover" style={[styles.preview, { backgroundColor: colors.cardMuted }]} />
      ) : null}

      {errors.form ? (
        <View style={{ marginTop: space.lg }}>
          <FieldError text={errors.form} />
        </View>
      ) : null}
    </Screen>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: space.lg, marginBottom: space.sm },
  input: { minHeight: MIN_TOUCH + 4, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 17 },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  preview: { height: 140, borderRadius: radius.md, marginTop: space.md },
});
