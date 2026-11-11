// Shared test setup: no test talks to a real Supabase project or native module.

import { resetRouterMock } from './test-utils/expo-router-mock';
import { resetSupabaseMock } from './test-utils/supabase-mock';

jest.mock('@/lib/supabase', () => ({
  ...jest.requireActual('./test-utils/supabase-mock'),
  isSupabaseConfigured: true,
}));

// Haptics are fire-and-forget; tests assert on them through this mock.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Reanimated runs its web implementation in tests (see the jest `resolver` in package.json).
require('react-native-reanimated').setUpTests();

beforeEach(() => {
  jest.clearAllMocks();
  resetSupabaseMock();
  resetRouterMock();
});
