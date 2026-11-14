import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pip } from '@/components/pip/pip';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

type Props = { title: string; children?: ReactNode };

/** A trip tab that isn't built yet: its title and a snoozing Pip. */
export function TabPlaceholder({ title, children }: Props) {
  return (
    <Screen withNav>
      <Text variant="title">{title}</Text>
      <View style={styles.body}>
        <Pip mood="snooze" size={120} />
        <Text variant="body" tone="secondary">
          Coming together…
        </Text>
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxl },
});
