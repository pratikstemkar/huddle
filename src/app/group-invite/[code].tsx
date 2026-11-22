import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { WelcomeScene } from '@/components/welcome-scene';
import { useAuth } from '@/lib/auth';
import { groupInvitePreview, peopleCount, type GroupInvitePreview } from '@/lib/groups';
import { useIntroSeen } from '@/lib/intro-seen';
import { savePendingInvite, takePendingInvite } from '@/lib/pending-invite';
import { space, tripColors } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Where a group's join link lands (`/group-invite/<code>`), signed in or not.
 * Signed in: straight on to the join screen. Signed out: show the group, keep the code through sign-in.
 */
export default function GroupInvite() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' ? params.code.trim() : '';

  if (session) return <Redirect href={code ? { pathname: '/join', params: { code } } : '/'} />;
  return <SignedOutInvite code={code} />;
}

function SignedOutInvite({ code }: { code: string }) {
  const { colors } = useTheme();
  const { markSeen } = useIntroSeen();
  // They came for a trip, so sign-in goes straight on to it, without the first-open intro.
  useEffect(() => markSeen(), [markSeen]);
  // 'offline': the preview couldn't load; they can still sign in and the join screen reports any real problem.
  const [state, setState] = useState<GroupInvitePreview | 'loading' | 'unknown' | 'offline'>(code ? 'loading' : 'unknown');

  useEffect(() => {
    if (!code) return;
    let live = true;
    savePendingInvite(code)
      .then(() => groupInvitePreview(code))
      .then(async (p) => {
        if (!p) await takePendingInvite();
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
      scarf={preview ? tripColors[preview.color] : undefined}
      tail={colors.beak}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.iris} accessibilityLabel="Loading the invite" />
        </View>
      ) : unknown ? (
        <>
          <View style={styles.copy}>
            <Text variant="title">This link doesn’t work</Text>
            <Text variant="bodyLg" tone="secondary">
              The link may be mistyped, or the group was deleted. Ask your friend to send it again.
            </Text>
          </View>
          <Button label="Go to Huddle" variant="outline" onPress={signIn} />
        </>
      ) : (
        <>
          <View style={styles.copy}>
            <Text variant="callout" tone="secondary">
              You’re invited to join
            </Text>
            <Text variant="title" numberOfLines={2}>
              {preview ? preview.name : 'a group on Huddle'}
            </Text>
            {preview ? (
              <Text variant="bodyStrong" tone="iris">
                {peopleCount(preview.members)} so far
              </Text>
            ) : null}
            <Text variant="callout" tone="secondary">
              Sign in and you’ll go straight to joining it. Then plan trips and hangouts together.
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
