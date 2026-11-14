export type IconShape =
  | { t: 'path'; d: string; fill?: string }
  | { t: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { t: 'circle'; cx: number; cy: number; r: number };

export type IconDef = {
  shapes: IconShape[];
  /** Filled glyphs (brand marks) ignore the stroke and use `fill` instead. */
  filled?: boolean;
  /** Stroke width the artboards use for this icon when none is given. */
  strokeWidth?: number;
};

export const iconPaths = {
  trips: { shapes: [{ t: 'path', d: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z' }, { t: 'path', d: 'M9 4v13M15 7v13' }] },
  invites: { shapes: [{ t: 'rect', x: 3, y: 5, width: 18, height: 14, rx: 3 }, { t: 'path', d: 'M3 8l9 6 9-6' }] },
  you: { shapes: [{ t: 'circle', cx: 12, cy: 8, r: 4 }, { t: 'path', d: 'M4 21c1-4 4-6 8-6s7 2 8 6' }] },
  trip: { shapes: [{ t: 'path', d: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }] },
  vote: { shapes: [{ t: 'path', d: 'M12 19V6M6 12l6-6 6 6' }] },
  plan: { shapes: [{ t: 'rect', x: 3, y: 5, width: 18, height: 16, rx: 3 }, { t: 'path', d: 'M3 10h18M8 3v4M16 3v4' }] },
  split: { shapes: [{ t: 'path', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' }] },
  photos: {
    shapes: [
      { t: 'rect', x: 3, y: 5, width: 18, height: 14, rx: 3 },
      { t: 'circle', cx: 9, cy: 10, r: 1.5 },
      { t: 'path', d: 'M21 16l-5-5-8 8' },
    ],
  },
  chevronRight: { shapes: [{ t: 'path', d: 'M9 6l6 6-6 6' }] },
  back: { shapes: [{ t: 'path', d: 'M15 6l-6 6 6 6' }] },
  plus: { shapes: [{ t: 'path', d: 'M12 5v14M5 12h14' }], strokeWidth: 2.4 },
  close: { shapes: [{ t: 'path', d: 'M6 6l12 12M18 6L6 18' }], strokeWidth: 2.2 },
  arrowRight: { shapes: [{ t: 'path', d: 'M5 12h14M13 6l6 6-6 6' }], strokeWidth: 2.2 },
  copy: {
    shapes: [
      { t: 'rect', x: 8, y: 8, width: 13, height: 13, rx: 3 },
      { t: 'path', d: 'M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3' },
    ],
  },
  share: { shapes: [{ t: 'path', d: 'M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5' }] },
  camera: { shapes: [{ t: 'path', d: 'M4 8h3l2-3h6l2 3h3v11H4z' }, { t: 'circle', cx: 12, cy: 13, r: 3.5 }] },
  mountain: { shapes: [{ t: 'path', d: 'M3 20l6-11 4 7 2-3 6 7z' }, { t: 'circle', cx: 17, cy: 6, r: 2 }] },
  food: { shapes: [{ t: 'path', d: 'M7 3v8a2 2 0 0 0 4 0V3M9 13v8M17 3c-2 2-3 5-3 8h3zM17 11v10' }] },
  stay: { shapes: [{ t: 'path', d: 'M3 11l9-7 9 7v9H3z' }, { t: 'path', d: 'M10 20v-6h4v6' }] },
  ride: {
    shapes: [
      { t: 'circle', cx: 6, cy: 17, r: 3 },
      { t: 'circle', cx: 18, cy: 17, r: 3 },
      { t: 'path', d: 'M6 17l4-8h5l3 8M10 9H7' },
    ],
  },
  apple: {
    filled: true,
    shapes: [
      {
        t: 'path',
        d: 'M16.4 12.6c0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.2zM13.9 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-3 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.3-.6 3-1.4z',
      },
    ],
  },
  google: {
    filled: true,
    shapes: [
      { t: 'path', d: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z', fill: '#4285F4' },
      { t: 'path', d: 'M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z', fill: '#34A853' },
      { t: 'path', d: 'M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z', fill: '#FBBC05' },
      { t: 'path', d: 'M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z', fill: '#EA4335' },
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof iconPaths;
