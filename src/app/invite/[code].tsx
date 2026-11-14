import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WelcomeScene } from '@/components/welcome-scene';
import { useAuth } from '@/lib/auth';
import { savePendingInvite, takePendingInvite } from '@/lib/pending-invite';
import { invitePreview, type InvitePreview } from '@/lib/trips';
import { space, toTripColor, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Where shared invite links land (`/invite/<code>`), signed in or not.
 * Signed in: straight on to the join sheet. Signed out: show the trip, keep the code through sign-in.
 */
export default function Invite() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.trim() : '';

  if (session) return <Redirect href={code ? { pathname: '/join', params: { code } } : '/'} />;
  return <SignedOutInvite code={code} />;
}

function SignedOutInvite({ code }: { code: string }) {
  const { colors } = useTheme();
  // 'offline': the preview couldn't load; they can still sign in and the join sheet reports any real problem.
  const [state, setState] = useState<InvitePreview | 'loading' | 'unknown' | 'offline'>(code ? 'loading' : 'unknown');

  useEffect(() => {
    if (!code) return;
    let live = true;
    savePendingInvite(code)
      .then(() => invitePreview(code))
      .then(async (p) => {
        if (!p) await takePendingInvite(); // nothing to join; don't send them to a failing join sheet later
        if (live) setState(p ?? 'unknown');
      })
      .catch(() => live && setState('offline'));
    return () => {
      live = false;
    };
  }, [code]);

  const loading = state === 'loading';
  const unknown = state === 'unknown';
  const preview = typeof state === 'object' ? state : null;
  const signIn = () => router.replace('/sign-in');

  return (
    <WelcomeScene
      pipMood={loading || unknown ? 'hmm' : 'hello'}
      pipLabel={loading || unknown ? 'Pip the penguin, thinking' : 'Pip the penguin waving hello'}
      scarf={preview ? tripColors[toTripColor(preview.color)] : undefined}
      tail={colors.beak}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.iris} accessibilityLabel="Loading the invite" />
        </View>
      ) : unknown ? (
        <>
          <View style={styles.copy}>
            <Text variant="title">This invite doesn’t work</Text>
            <Text variant="bodyLg" tone="secondary">
              The link may be mistyped, or the trip was deleted. Ask your friend to send it again.
            </Text>
          </View>
          <Button label="Go to Huddle" variant="outline" onPress={signIn} />
        </>
      ) : (
        <>
          <View style={styles.copy}>
            <Text variant="callout" tone="secondary">
              You’re invited to
            </Text>
            <Text variant="title" numberOfLines={2}>
              {preview ? preview.name : 'a trip on Huddle'}
            </Text>
            {preview ? (
              <Text variant="bodyStrong" tone="iris">
                {preview.members === 1 ? '1 person is going' : `${preview.members} people are going`}
              </Text>
            ) : null}
            <Text variant="callout" tone="secondary">
              Sign in and you’ll go straight to joining it. Mark when you’re free and vote on where to go.
            </Text>
          </View>
          <Button label="Sign in to join" variant="ink" onPress={signIn} />
        </>
      )}
    </WelcomeScene>
  );
}

const styles = StyleSheet.create({
  copy: { gap: space.sm },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
});
