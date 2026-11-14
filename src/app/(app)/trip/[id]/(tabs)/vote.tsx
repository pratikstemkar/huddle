import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useRegisterPipAction } from '@/components/nav/pip-action';
import { TabPlaceholder } from '@/components/nav/tab-placeholder';
import { Button } from '@/components/ui/button';
import { space } from '@/theme/tokens';

export default function VoteTab() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const suggest = useCallback(() => router.push({ pathname: '/trip/[id]/suggest', params: { id } }), [id]);
  useRegisterPipAction('Suggest a place', suggest);

  return (
    <TabPlaceholder title="Vote">
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        <Button label="Places" variant="outline" onPress={() => router.push({ pathname: '/trip/[id]/places', params: { id } })} />
        <Button label="Dates" variant="outline" onPress={() => router.push({ pathname: '/trip/[id]/days', params: { id } })} />
      </View>
    </TabPlaceholder>
  );
}
