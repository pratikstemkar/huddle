import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { InvitePanel } from '@/components/invite-panel';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { space } from '@/theme/tokens';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function InviteSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen footer={<Button label="Done" variant="ink" onPress={close} />}>
      <View style={styles.header}>
        <IconButton icon="close" accessibilityLabel="Close" onPress={close} />
        <Text variant="titleSm">Invite</Text>
      </View>
      {id ? <InvitePanel tripId={id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.s18 },
});
