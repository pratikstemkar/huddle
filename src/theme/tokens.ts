/**
 * Huddle design tokens.
 *
 * Rules of thumb:
 * - Screens are mostly `bg` and `card`. `iris` marks the one main action and votes.
 * - `beak` is saved for good news: countdowns, wins and the Pip button.
 * - Tints only colour the five trip areas (Trip, Vote, Plan, Split, Photos).
 * - Text on iris is `onIris`, on beak `onBeak`, on ink `onInk`. Text on a tint is `text`.
 */

export type TintArea = 'trip' | 'vote' | 'plan' | 'split' | 'photos';

export type Colors = {
  bg: string;
  card: string;
  line: string;
  lineStrong: string;
  dashed: string;
  track: string;
  /** The knob of an on/off switch, on or off. */
  thumb: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  iris: string;
  irisPressed: string;
  irisText: string;
  onIris: string;
  beak: string;
  onBeak: string;
  ink: string;
  onInk: string;
  positive: string;
  owe: string;
  danger: string;
  cheek: string;
  overlay: string;
  navGlass: string;
  heat: readonly string[];
  tint: Readonly<Record<TintArea, string>>;
};

const light: Colors = {
  bg: '#F4F5FB',
  card: '#FFFFFF',
  line: '#E4E6F1',
  lineStrong: '#D5D8E8',
  dashed: '#B9BDD6',
  track: '#E4E6F1',
  thumb: '#FFFFFF',
  text: '#171A2F',
  textSecondary: '#5A5F7A',
  textMuted: '#8A8FA8',
  iris: '#5257E8',
  irisPressed: '#4449D6',
  irisText: '#3F43C9',
  onIris: '#FFFFFF',
  beak: '#FFC23D',
  onBeak: '#171A2F',
  ink: '#171A2F',
  onInk: '#FFFFFF',
  positive: '#0B7A6C',
  owe: '#B4530A',
  danger: '#C62D3A',
  cheek: '#FF9FB2',
  overlay: 'rgba(23, 26, 47, 0.45)',
  navGlass: 'rgba(255, 255, 255, 0.88)',
  heat: ['#ECEDF6', '#C7C9FA', '#8E92F0', '#5257E8'],
  tint: { trip: '#FFF1CC', vote: '#E9EAFF', plan: '#FFE9D6', split: '#DDF5EE', photos: '#FFE3EA' },
};

const dark: Colors = {
  bg: '#10121F',
  card: '#1B1E33',
  line: '#343857',
  lineStrong: '#454A6E',
  dashed: '#4A4F75',
  track: '#262A45',
  thumb: '#F1F2FA',
  text: '#F1F2FA',
  textSecondary: '#B9BDD6',
  textMuted: '#8287A6',
  iris: '#8286FF',
  irisPressed: '#9599FF',
  irisText: '#A9ACFF',
  onIris: '#10121F',
  beak: '#FFC23D',
  onBeak: '#171A2F',
  ink: '#F1F2FA',
  onInk: '#10121F',
  positive: '#4FD1B5',
  owe: '#FFA25C',
  danger: '#FF7A85',
  cheek: '#FF9FB2',
  overlay: 'rgba(0, 0, 0, 0.6)',
  navGlass: 'rgba(27, 30, 51, 0.88)',
  heat: ['#24283F', '#363A7A', '#5A5EC4', '#8286FF'],
  tint: { trip: '#3A3220', vote: '#2A2D5C', plan: '#3D2A1F', split: '#173A35', photos: '#3D2230' },
};

export const palette: { readonly light: Colors; readonly dark: Colors } = { light, dark };

export type Scheme = keyof typeof palette;

/** One colour per trip, picked at creation. Same in both modes. */
export const tripColors = {
  iris: '#5257E8',
  beak: '#FFC23D',
  mint: '#3CC5A5',
  blush: '#FF8FA8',
  coral: '#FF8A4C',
} as const;
export type TripColor = keyof typeof tripColors;

/** The light tint of each trip colour: avatar backgrounds and card tiles, with an ink initial on top. */
export const tripTints: Record<TripColor, string> = {
  iris: '#E9EAFF',
  beak: '#FFF1CC',
  mint: '#DDF5EE',
  blush: '#FFE3EA',
  coral: '#FFE9D6',
};

/** Readable text on each trip colour's full fill. */
export const onTripColor: Record<TripColor, string> = {
  iris: '#FFFFFF',
  beak: '#171A2F',
  mint: '#171A2F',
  blush: '#171A2F',
  coral: '#171A2F',
};

export const TRIP_COLOR_NAMES: Record<TripColor, string> = {
  iris: 'Iris',
  beak: 'Beak yellow',
  mint: 'Mint',
  blush: 'Blush',
  coral: 'Coral',
};

const LEGACY_TRIP_COLORS: Record<string, TripColor> = {
  sunset: 'coral',
  lagoon: 'mint',
  mango: 'beak',
  plum: 'iris',
  bougainvillea: 'blush',
  sky: 'iris',
};

/** Any stored colour key (current or from older app versions) as a current trip colour; iris when unknown. */
export function toTripColor(key: string | null | undefined): TripColor {
  if (!key) return 'iris';
  if (key in tripColors) return key as TripColor;
  return LEGACY_TRIP_COLORS[key] ?? 'iris';
}

export const space = {
  xxs: 2,
  xs: 4,
  s6: 6,
  sm: 8,
  s10: 10,
  md: 12,
  s14: 14,
  lg: 16,
  s18: 18,
  s20: 20,
  xl: 24,
  s28: 28,
  xxl: 32,
  xxxl: 48,
  screenX: 20,
  section: 16,
  listGap: 12,
  navGap: 10,
} as const;

export const radius = {
  xs: 4,
  badgeSm: 9,
  badge: 10,
  sm: 12,
  tile: 14,
  md: 16,
  tileLg: 18,
  lg: 20,
  pill44: 22,
  card: 24,
  xl: 28,
  nav: 32,
  sheetTop: 36,
  icon: 38,
  pill: 999,
} as const;

/** The "Pip says" bubble: round everywhere except the corner pointing at Pip. */
export const speechRadius = {
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  borderBottomRightRadius: 22,
  borderBottomLeftRadius: 6,
} as const;

export const fonts = {
  wordmark: 'BricolageGrotesque_800ExtraBold',
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
} as const;

/** Titles and numbers use Bricolage. Body text uses the system font so dynamic type and browser zoom behave. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -0.88 },
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.68 },
  titleSm: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26 },
  number: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  numberSm: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22 },
  numberXs: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20 },
  bodyLg: { fontSize: 17, lineHeight: 25 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20 },
  calloutStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  badge: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tab: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const;
export type TypeVariant = keyof typeof type;

/** The wordmark's letter-spacing is −4% of its size. */
export const wordmarkStyle = (size: number) => ({
  fontFamily: fonts.wordmark,
  fontSize: size,
  lineHeight: size,
  letterSpacing: -0.04 * size,
});

export const shadow = {
  light: {
    nav: '0 10px 30px rgba(23, 26, 47, 0.14)',
    pipButton: '0 10px 30px rgba(23, 26, 47, 0.18)',
    icon: '0 10px 24px rgba(23, 26, 47, 0.16)',
  },
  dark: {
    nav: '0 10px 30px rgba(0, 0, 0, 0.4)',
    pipButton: '0 10px 30px rgba(0, 0, 0, 0.4)',
    icon: '0 10px 24px rgba(0, 0, 0, 0.4)',
  },
} as const;

/** Spring presets for Reanimated `withSpring`. */
export const springs = {
  press: { damping: 15, stiffness: 400, mass: 0.6 },
  gentle: { damping: 18, stiffness: 180 },
  bouncy: { damping: 10, stiffness: 220 },
  pip: { damping: 12, stiffness: 180 },
} as const;

export const MIN_TOUCH = 44;
export const MAX_CONTENT_WIDTH = 520;

export const NAV_HEIGHT = 64;
export const NAV_INSET = 16;
export const NAV_BOTTOM = 20;

/** Bottom padding that keeps scroll content clear of the floating tab bar. */
export function navClearance(insets: { bottom: number }) {
  return NAV_HEIGHT + NAV_BOTTOM + insets.bottom + 16;
}
