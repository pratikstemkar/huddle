import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { formatDay } from '@/lib/dates';
import { PRIVACY_CONTROLLER, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '@/lib/privacy';
import { space } from '@/theme/tokens';

/** Public: readable signed in or out, and the URL the app stores link to. */
export default function PrivacyPolicy() {
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen footer={<Button label="Done" variant="ink" onPress={close} />}>
      <IconButton icon="back" accessibilityLabel="Back" onPress={close} />
      <Text variant="title" style={{ marginTop: space.lg }}>
        Privacy policy
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginTop: space.xs }}>
        Last updated {formatDay(PRIVACY_UPDATED)}
      </Text>
      <Text variant="body" tone="secondary" style={{ marginTop: space.lg }}>
        Huddle is run by {PRIVACY_CONTROLLER}. This explains what the app keeps about you, who can see it, and how to delete it.
      </Text>

      <View style={styles.list}>
        {PRIVACY_SECTIONS.map((s) => (
          <Card key={s.title} style={styles.section}>
            <Text variant="heading">{s.title}</Text>
            {s.body.map((p) => (
              <Text key={p} variant="body">
                {p}
              </Text>
            ))}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.xl, gap: space.md },
  section: { padding: space.s20, gap: space.sm },
});
