import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { loadThemePreference, resolveScheme, ThemePreferenceProvider, useThemePreference } from '@/theme/theme-preference';
import { palette } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => <ThemePreferenceProvider>{children}</ThemePreferenceProvider>;

function useBoth() {
  return { theme: useTheme(), pref: useThemePreference() };
}

describe('resolveScheme', () => {
  it.each([
    ['system', 'dark', 'dark'],
    ['system', 'light', 'light'],
    ['system', null, 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)('%s with a %p phone gives %s', (pref, system, expected) => {
    expect(resolveScheme(pref, system)).toBe(expected);
  });
});

describe('theme preference', () => {
  const system = useColorScheme as jest.Mock;
  let setColorScheme: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    system.mockReturnValue('light');
    setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  });

  afterEach(() => setColorScheme.mockRestore());

  it('follows the phone until something is picked', async () => {
    const { result } = await renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.pref.loaded).toBe(true));
    expect(result.current.pref.preference).toBe('system');
    expect(result.current.theme.scheme).toBe('light');
  });

  it('overrides the phone, remembers the choice and tells native controls', async () => {
    const { result } = await renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.pref.loaded).toBe(true));

    await act(async () => result.current.pref.setPreference('dark'));
    expect(result.current.theme.scheme).toBe('dark');
    expect(result.current.theme.colors).toBe(palette.dark);
    expect(await AsyncStorage.getItem('huddle.theme')).toBe('dark');
    if (Platform.OS !== 'web') expect(setColorScheme).toHaveBeenLastCalledWith('dark');

    await act(async () => result.current.pref.setPreference('system'));
    expect(result.current.theme.scheme).toBe('light');
    if (Platform.OS !== 'web') expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');
  });

  it('starts in the saved theme', async () => {
    await AsyncStorage.setItem('huddle.theme', 'dark');
    const { result } = await renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.pref.loaded).toBe(true));
    expect(result.current.theme.scheme).toBe('dark');
  });

  it('ignores a garbled saved value', async () => {
    await AsyncStorage.setItem('huddle.theme', 'purple');
    expect(await loadThemePreference()).toBe('system');
  });
});
