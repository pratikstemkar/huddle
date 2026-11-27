import { router } from 'expo-router';

/** Back one step in the Explore flow, or Home when it was opened directly (a link or a reload). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
