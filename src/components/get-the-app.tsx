import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { currentVisitorPlatform, useLatestApkUrl } from '@/lib/app-download';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ANDROID_STEPS = [
  'Tap Download for Android. Your phone saves a file called huddle-….apk.',
  'Open it from the download notification, or from Files → Downloads.',
  'If Android asks, let your browser install unknown apps, then go back.',
  'Tap Install. If Play Protect warns you, tap More details → Install anyway.',
  'Open Huddle and sign in, then tap this invite link again to join.',
];

type Props = {
  /** The app path this page is for, e.g. `invite/goa2027`, so "Open the app" lands on the same screen. */
  path: string;
  /** Carries on in this browser: the existing web sign-in, with the invite kept. */
  onContinueOnWeb: () => void;
};

/** Leaves the page for a download or the app. Same tab, so nothing is blocked as a popup. */
function go(url: string) {
  window.location.assign(url);
}

/**
 * Web only. Shown on an invite link opened in a browser: the app isn't installed, or the link didn't
 * hand off to it. Android gets the APK and how to install it; iPhone carries on in the web app.
 */
export function GetTheApp({ path, onContinueOnWeb }: Props) {
  const { colors } = useTheme();
  const [platform] = useState(currentVisitorPlatform);
  const apkUrl = useLatestApkUrl();
  const android = platform !== 'ios';
  const ios = platform !== 'android';

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text variant="heading">Huddle works best in the app</Text>
        <Text variant="callout" tone="secondary">
          You get notified when friends vote or the plan is locked, and it’s quicker to use.
        </Text>
      </View>

      {android ? (
        <View style={styles.block}>
          <Button label="Download for Android" variant="ink" icon="download" onPress={() => go(apkUrl)} />
          <View style={[styles.steps, { backgroundColor: colors.bg }]} accessibilityRole="list" accessibilityLabel="How to install on Android">
            <Text variant="calloutStrong">Installing on Android</Text>
            {ANDROID_STEPS.map((step, i) => (
              <View key={step} style={styles.step} accessibilityRole="text">
                <View style={[styles.num, { backgroundColor: colors.iris }]}>
                  <Text variant="caption" tone="onIris">
                    {i + 1}
                  </Text>
                </View>
                <Text variant="callout" tone="secondary" style={styles.stepText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {ios ? (
        <View style={styles.block}>
          <Button
            label="On iPhone? Use Huddle on the web"
            variant={android ? 'outline' : 'ink'}
            icon="apple"
            onPress={onContinueOnWeb}
          />
          <Text variant="caption" tone="muted" style={styles.center}>
            The iPhone app isn’t out yet. The web app works the same in Safari.
          </Text>
        </View>
      ) : null}

      <View style={styles.block}>
        {platform === 'android' ? (
          <Button label="I already have Huddle: open it" variant="outline" onPress={() => go(`huddle://${path}`)} />
        ) : null}
        {platform !== 'ios' ? <Button label="Continue on the web" variant="ghost" onPress={onContinueOnWeb} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xl },
  copy: { gap: space.xs },
  block: { gap: space.md },
  steps: { borderRadius: radius.md, padding: space.lg, gap: space.md },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepText: { flex: 1 },
  center: { textAlign: 'center' },
});
