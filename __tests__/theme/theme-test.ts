import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { MIN_TOUCH, navClearance, onTripColor, palette, toTripColor, tripColors, tripTints, TRIP_COLOR_NAMES, type TintArea } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));

/** WCAG relative luminance contrast ratio for two #RRGGBB colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens', () => {
  it('light and dark palettes define the same colours', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
    expect(palette.dark.heat).toHaveLength(palette.light.heat.length);
  });

  it.each(['light', 'dark'] as const)('%s text is readable on the backgrounds (WCAG AA)', (scheme) => {
    const c = palette[scheme];
    expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textSecondary, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textSecondary, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onIris, c.iris)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onBeak, c.beak)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onInk, c.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.irisText, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.positive, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.owe, c.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.danger, c.card)).toBeGreaterThanOrEqual(4.5);
    for (const area of Object.keys(c.tint) as TintArea[]) {
      expect(contrast(c.text, c.tint[area])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.irisText, c.tint[area])).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c.onIris, c.heat[3])).toBeGreaterThanOrEqual(4.5);
  });

  it('every trip colour has a tint, a readable text colour and a name', () => {
    expect(Object.keys(tripColors).sort()).toEqual(['beak', 'blush', 'coral', 'iris', 'mint']);
    for (const key of Object.keys(tripColors) as (keyof typeof tripColors)[]) {
      expect(contrast(onTripColor[key], tripColors[key])).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#171A2F', tripTints[key])).toBeGreaterThanOrEqual(4.5);
      expect(TRIP_COLOR_NAMES[key]).toBeTruthy();
    }
  });

  it.each([
    ['iris', 'iris'],
    ['mint', 'mint'],
    ['sunset', 'coral'],
    ['lagoon', 'mint'],
    ['mango', 'beak'],
    ['plum', 'iris'],
    ['bougainvillea', 'blush'],
    ['sky', 'iris'],
    ['nonsense', 'iris'],
    ['', 'iris'],
    [null, 'iris'],
    [undefined, 'iris'],
  ])('maps the stored colour %p to %p', (stored, expected) => {
    expect(toTripColor(stored)).toBe(expected);
  });

  it('keeps tab content clear of the floating nav', () => {
    expect(navClearance({ bottom: 0 })).toBe(100);
    expect(navClearance({ bottom: 34 })).toBe(134);
  });

  it('touch targets are at least 44pt', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(44);
  });
});

describe('useTheme', () => {
  const scheme = useColorScheme as jest.Mock;

  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    [null, 'light'],
    ['unspecified', 'light'],
  ])('system %p gives the %s palette', async (system, expected) => {
    scheme.mockReturnValue(system);
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe(expected);
    expect(result.current.colors).toBe(palette[expected as 'light' | 'dark']);
  });
});

describe('useReducedMotion', () => {
  it('reads the setting and follows changes', async () => {
    let listener: ((v: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, cb: (v: boolean) => void) => {
      listener = cb;
      return { remove };
    }) as never);

    const { result, unmount } = await renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    await act(async () => listener!(false));
    expect(result.current).toBe(false);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
