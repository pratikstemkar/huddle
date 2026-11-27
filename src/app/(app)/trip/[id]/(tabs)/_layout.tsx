import { TabList, Tabs, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { PillTabBar, type PillTab } from '@/components/nav/pill-tab-bar';
import { PipActionProvider } from '@/components/nav/pip-action';
import { SlidingTabSlot } from '@/components/nav/sliding-tab-slot';
import { useTheme } from '@/theme/use-theme';
import { useTripId } from '@/components/nav/trip-id';

const TABS: PillTab[] = [
  { name: 'index', label: 'Trip', icon: 'trip' },
  { name: 'vote', label: 'Vote', icon: 'vote' },
  { name: 'plan', label: 'Plan', icon: 'plan' },
  { name: 'split', label: 'Split', icon: 'split' },
  { name: 'photos', label: 'Photos', icon: 'photos' },
];

export default function TripTabsLayout() {
  const { colors } = useTheme();
  const id = useTripId() ?? '';
  return (
    <PipActionProvider>
      <Tabs style={[styles.root, { backgroundColor: colors.bg }]}>
        <SlidingTabSlot />
        <PillTabBar accessibilityLabel="Trip" tabs={TABS} tourPrefix="trip" />
        <TabList style={styles.hidden}>
          <TabTrigger name="index" href={{ pathname: '/trip/[id]', params: { id } }} />
          <TabTrigger name="vote" href={{ pathname: '/trip/[id]/vote', params: { id } }} />
          <TabTrigger name="plan" href={{ pathname: '/trip/[id]/plan', params: { id } }} />
          <TabTrigger name="split" href={{ pathname: '/trip/[id]/split', params: { id } }} />
          <TabTrigger name="photos" href={{ pathname: '/trip/[id]/photos', params: { id } }} />
        </TabList>
      </Tabs>
    </PipActionProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
