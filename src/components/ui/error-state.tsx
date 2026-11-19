import { StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

type Props = {
  /** What went wrong, in plain words. */
  message: string;
  title?: string;
  onRetry?: () => void;
};

/** A failed load. Shown instead of the empty state, never beside it, with a way to try again. */
export function ErrorState({ message, title = 'Something went wrong', onRetry }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Pip mood="snooze" size={84} />
      <Text variant="titleSm" style={styles.center}>
        {title}
      </Text>
      <Text variant="callout" tone="secondary" style={styles.center}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="outline" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  center: { textAlign: 'center' },
});
