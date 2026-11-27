import { Linking } from 'react-native';

import { Text } from '@/components/ui/text';

/** "Photo: <name> on Unsplash", as Unsplash's licence asks for hotlinked images. */
export function PhotoCredit({ name }: { name: string }) {
  return (
    <Text
      variant="caption"
      tone="muted"
      accessibilityRole="link"
      onPress={() => Linking.openURL('https://unsplash.com/?utm_source=huddle&utm_medium=referral').catch(() => {})}>
      Photo: {name} on Unsplash
    </Text>
  );
}
