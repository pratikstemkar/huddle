#!/usr/bin/env node
// Writes the Huddle brand SVGs to assets/brand/ and rasterises them into assets/images/ with headless Chrome.
// Usage: node scripts/brand-icons.mjs [path-to-chrome]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'assets/brand');
const imagesDir = join(root, 'assets/images');

const IRIS = '#5257E8';
const INK = '#171A2F';
const BEAK = '#FFC23D';
const CHEEK = '#FF9FB2';
const BODY = 'M60 6c25 0 42 22 42 54s-17 56-42 56-42-24-42-56S35 6 60 6z';

/** Icon B: ink Pip in a beak scarf, cropped to the bust (viewBox 14 2 92 86). */
const pipBust = ({ highlights = true } = {}) => `
  <path d="${BODY}" fill="${INK}"/>
  <ellipse cx="60" cy="80" rx="27" ry="32" fill="#fff"/>
  <circle cx="46" cy="47" r="16" fill="#fff"/><circle cx="74" cy="47" r="16" fill="#fff"/>
  <circle cx="48" cy="47" r="4.5" fill="${INK}"/><circle cx="72" cy="47" r="4.5" fill="${INK}"/>
  ${highlights ? '<circle cx="49.6" cy="45.4" r="1.5" fill="#fff"/><circle cx="73.6" cy="45.4" r="1.5" fill="#fff"/>' : ''}
  <circle cx="37" cy="57" r="4.5" fill="${CHEEK}"/><circle cx="83" cy="57" r="4.5" fill="${CHEEK}"/>
  <path d="M52 55q8-5 16 0q-8 10-16 0z" fill="${BEAK}"/>
  <path d="M27 68q33 12 66 0l2 9q-35 13-70 0z" fill="${BEAK}"/>`;

/** The 32px art from the logo sheet: bigger pupils and beak, no cheeks or scarf. */
const pipSmall = `
  <path d="${BODY}" fill="${INK}"/>
  <circle cx="46" cy="47" r="16" fill="#fff"/><circle cx="74" cy="47" r="16" fill="#fff"/>
  <circle cx="48" cy="47" r="6" fill="${INK}"/><circle cx="72" cy="47" r="6" fill="${INK}"/>
  <path d="M50 55q10-6 20 0q-10 12-20 0z" fill="${BEAK}"/>`;

const doc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
const bust = (x, y, w, h, art) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="14 2 92 86">${art}</svg>`;

// The logo sheet places a 134 x 125 bust at the bottom centre of a 168 tile.
const tile = (size) => {
  const k = size / 168;
  const w = 134 * k;
  const h = 125 * k;
  return bust((size - w) / 2, size - h, w, h, pipBust());
};

const files = {
  'icon.svg': { size: [1024, 1024], svg: doc(1024, 1024, `<rect width="1024" height="1024" fill="${IRIS}"/>${tile(1024)}`) },
  'android-icon-foreground.svg': {
    size: [512, 512],
    svg: doc(512, 512, bust((512 - 300) / 2, (512 - 280) / 2, 300, 280, pipBust())),
  },
  'android-icon-background.svg': { size: [512, 512], svg: doc(512, 512, `<rect width="512" height="512" fill="${IRIS}"/>`) },
  'android-icon-monochrome.svg': {
    size: [432, 432],
    svg: doc(
      432,
      432,
      `<defs><mask id="m" maskUnits="userSpaceOnUse" x="14" y="2" width="92" height="86">
        <path d="${BODY}" fill="#fff"/>
        <circle cx="46" cy="47" r="16" fill="#000"/><circle cx="74" cy="47" r="16" fill="#000"/>
        <circle cx="48" cy="47" r="5" fill="#fff"/><circle cx="72" cy="47" r="5" fill="#fff"/>
      </mask></defs>${bust((432 - 252) / 2, (432 - 236) / 2, 252, 236, `<rect x="14" y="2" width="92" height="86" fill="#fff" mask="url(#m)"/>`)}`,
    ),
  },
  'favicon.svg': {
    size: [48, 48],
    svg: doc(48, 48, `<rect width="48" height="48" rx="12" fill="${IRIS}"/>${bust((48 - 39) / 2, 48 - 36, 39, 36, pipSmall)}`),
  },
  'splash-icon.svg': { size: [228, 213], svg: doc(228, 213, bust(0, 0, 228, 213, pipBust())) },
};

mkdirSync(brandDir, { recursive: true });
for (const [name, { svg }] of Object.entries(files)) writeFileSync(join(brandDir, name), svg);
console.log(`Wrote ${Object.keys(files).length} SVGs to assets/brand/`);

const chrome = process.argv[2] ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
if (!chrome) {
  console.error('No Chrome found; pass its path to rasterise the PNGs.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'huddle-brand-'));
try {
  for (const [name, { size, svg }] of Object.entries(files)) {
    const [w, h] = size;
    const html = join(profile, `${name}.html`);
    writeFileSync(html, `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    const out = join(imagesDir, name.replace(/\.svg$/, '.png'));
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        `--user-data-dir=${join(profile, 'chrome')}`,
        '--default-background-color=00000000',
        '--force-device-scale-factor=1',
        `--window-size=${w},${h}`,
        `--screenshot=${out}`,
        `file://${html}`,
      ],
      { stdio: 'ignore' },
    );
    console.log(`Rendered ${out.replace(`${root}/`, '')} (${w}x${h})`);
  }
} finally {
  rmSync(profile, { recursive: true, force: true });
}
