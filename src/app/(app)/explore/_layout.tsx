import { Stack } from 'expo-router';

import { useTheme } from '@/theme/use-theme';

/** Ready-made trips: destinations, then a destination's plans, then one plan's days. */
export default function ExploreLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
