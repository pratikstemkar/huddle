// Shared test setup: no test talks to a real Supabase project or native module.

import { resetRouterMock } from './test-utils/expo-router-mock';
import { resetPhotoMocks } from './test-utils/photo-mocks';
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

// Photo picking, resizing and the device's Huddle folder are native; tests drive these fakes instead.
jest.mock('expo-image-picker', () => require('./test-utils/photo-mocks').imagePicker);
jest.mock('expo-image-manipulator', () => require('./test-utils/photo-mocks').imageManipulator);
jest.mock('expo-file-system', () => require('./test-utils/photo-mocks').fileSystem);

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Reanimated runs its web implementation in tests (see the jest `resolver` in package.json).
require('react-native-reanimated').setUpTests();

beforeEach(() => {
  jest.clearAllMocks();
  resetSupabaseMock();
  resetRouterMock();
  resetPhotoMocks();
});
