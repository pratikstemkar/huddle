import { router } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { PillTabBar, type PillTab } from '@/components/nav/pill-tab-bar';
import { PipButton } from '@/components/nav/pip-button';
import { useTheme } from '@/theme/use-theme';

const TABS: PillTab[] = [
  { name: 'index', label: 'Trips', icon: 'trips' },
  { name: 'join', label: 'Invites', icon: 'invites' },
  { name: 'profile', label: 'You', icon: 'you' },
];

export default function HomeTabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs style={[styles.root, { backgroundColor: colors.bg }]}>
      <TabSlot />
      <PillTabBar
        accessibilityLabel="Main"
        tabs={TABS}
        trailing={<PipButton accessibilityLabel="Pip: start a new trip" onPress={() => router.push('/new-trip')} />}
      />
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="join" href="/join" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
