/**
 * A stand-in for `expo-router` in screen tests:
 *   jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));
 * `router` methods are jest mocks, `setParams` sets what `useLocalSearchParams` returns,
 * and `useFocusEffect` runs like an effect (the screen is always focused).
 */
import { useEffect, type ReactNode } from 'react';

let params: Record<string, string | undefined> = {};

export function setParams(next: Record<string, string | undefined>) {
  params = next;
}

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export function resetRouterMock() {
  params = {};
  for (const fn of Object.values(router)) fn.mockClear();
  router.canGoBack.mockReturnValue(true);
}

export const useLocalSearchParams = () => params;

export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect]);
}

export function Link({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
