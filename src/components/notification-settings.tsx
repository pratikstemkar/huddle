import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { DEFAULT_PREFS, loadPrefs, PREF_LABELS, savePrefs, type NotificationPrefs } from '@/lib/activity';
import { openSystemSettings, pushPermission, registerForPush, type PushPermission } from '@/lib/notifications';
import { space } from '@/theme/tokens';

/** The You tab's Notifications card: whether this phone gets pushes, and which kinds. */
export function NotificationSettings({ userId }: { userId: string | undefined }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushPermission().then(setPermission, () => setPermission('unsupported'));
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadPrefs(userId).then(setPrefs, () => setError("Couldn't load your notification settings."));
  }, [userId]);

  const toggle = useCallback(
    async (key: keyof NotificationPrefs, value: boolean) => {
      if (!userId) return;
      const before = prefs;
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      setError(null);
      try {
        await savePrefs(userId, next);
      } catch {
        setPrefs(before);
        setError("Couldn't save that. Check your connection and try again.");
      }
    },
    [prefs, userId],
  );

  return (
    <View style={styles.group}>
      <Text variant="calloutStrong">Notifications</Text>
      {permission === 'unsupported' ? (
        <Text variant="caption" tone="secondary">
          Push notifications reach you in the Huddle app on your phone. Here, they show up under Activity on Home.
        </Text>
      ) : permission === 'denied' ? (
        <>
          <Text variant="caption" tone="secondary">
            Notifications are off for Huddle on this phone.
          </Text>
          <Button label="Open Settings" variant="outline" size="md" onPress={openSystemSettings} />
        </>
      ) : permission === 'undetermined' ? (
        <Button
          label="Turn on notifications"
          variant="outline"
          size="md"
          onPress={async () => setPermission(await registerForPush({ prompt: true }))}
        />
      ) : null}

      {PREF_LABELS.map(({ key, label, hint }) => (
        <View key={key} style={styles.row}>
          <View style={styles.rowText}>
            <Text variant="label">{label}</Text>
            <Text variant="caption" tone="secondary">
              {hint}
            </Text>
          </View>
          <Toggle
            accessibilityLabel={label}
            accessibilityHint={hint}
            value={prefs[key]}
            onValueChange={(v) => toggle(key, v)}
          />
        </View>
      ))}
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.s10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowText: { flex: 1, gap: space.xxs },
});
