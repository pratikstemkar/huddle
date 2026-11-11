/**
 * Sunset club design tokens.
 *
 * Rules of thumb:
 * - Most of a screen is `bg` / `card`. The `accent` is for the one primary action and the heatmap.
 * - `votes` is for upvotes and vote counts, `celebrate` for countdowns and "trip locked" moments.
 * - Text on `accent`, `votes` and `celebrate` is always `onColor` (near-black) for contrast.
 */

export const palette = {
  light: {
    bg: '#FFF6EC',
    card: '#FFFFFF',
    cardMuted: '#FBEEDF',
    line: '#F0E2D2',
    text: '#1B1420',
    textSecondary: '#6E6070',
    textMuted: '#9A8C9C',
    accent: '#FF5A36',
    accentPressed: '#E84A28',
    votes: '#0FA3A3',
    celebrate: '#FFC531',
    onColor: '#1B1420',
    danger: '#D93A3A',
    overlay: 'rgba(27, 20, 32, 0.45)',
    heat: ['#F6E8D8', '#FFC9B5', '#FF9370', '#FF5A36'],
  },
  dark: {
    bg: '#15111A',
    card: '#221C29',
    cardMuted: '#1C1722',
    line: '#2F2738',
    text: '#FFF3E6',
    textSecondary: '#B3A7B8',
    textMuted: '#857A8A',
    accent: '#FF6B47',
    accentPressed: '#FF8466',
    votes: '#2CC8C2',
    celebrate: '#FFD15C',
    onColor: '#15111A',
    danger: '#FF6B6B',
    overlay: 'rgba(0, 0, 0, 0.6)',
    heat: ['#2A2230', '#6B3229', '#B44A33', '#FF6B47'],
  },
} as const;

export type Scheme = keyof typeof palette;
export type Colors = { [K in keyof (typeof palette)['light']]: K extends 'heat' ? readonly string[] : string };

/** One colour per trip, picked at creation. Same in both modes. */
export const tripColors = {
  sunset: '#FF5A36',
  lagoon: '#0FA3A3',
  mango: '#FFC531',
  plum: '#8E5BD9',
  bougainvillea: '#F2569B',
  sky: '#3D8BFF',
} as const;
export type TripColor = keyof typeof tripColors;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
} as const;

/** Body text uses the system font so dynamic type / browser zoom behave. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
} as const;
export type TypeVariant = keyof typeof type;

/** Spring presets for Reanimated `withSpring`. */
export const springs = {
  press: { damping: 15, stiffness: 400, mass: 0.6 },
  gentle: { damping: 18, stiffness: 180 },
  bouncy: { damping: 10, stiffness: 220 },
} as const;

export const MIN_TOUCH = 48;
export const MAX_CONTENT_WIDTH = 520;
