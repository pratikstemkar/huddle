import { useEffect, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/use-theme';
import { Layer, StaticLayer, type Frame } from './layer';
import { ease, type MotionSpec, type Track } from './motion';

export type PipMood = 'idle' | 'hello' | 'yay' | 'hmm' | 'snooze' | 'peek';
export type PipCrop = 'full' | 'peek' | 'icon';

export type PipProps = {
  mood?: PipMood;
  /** Width in points; the height follows the crop. */
  size?: number;
  scarf?: string;
  tail?: string;
  coat?: string;
  beakColor?: string;
  crop?: PipCrop;
  shades?: boolean;
  /** Holds the right flipper up in a still wave (hero cards). */
  wavePose?: boolean;
  shadow?: boolean;
  /** Degrees either way for the `hmm` tilt. */
  tilt?: number;
  /** Change it to replay a one-off mood (a second vote, another tap). */
  replay?: number;
  /** Called when a one-off mood (hello, yay, peek) finishes and Pip is back to idle. */
  onSettled?: () => void;
  /** Without one, Pip is decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const INK = '#171A2F';
const IRIS = '#5257E8';
const BEAK = '#FFC23D';
const CHEEK = '#FF9FB2';
const EFFECT = '#3F43C9';

const VIEWBOX: Record<PipCrop, readonly [number, number, number, number]> = {
  full: [0, 0, 120, 124],
  peek: [10, 0, 100, 76],
  icon: [14, 2, 92, 86],
};

const BEAK_SMILE = 'M52 55q8-5 16 0q-8 10-16 0z';
const BEAK_SMILE_LOW = 'M52 57q8-5 16 0q-8 10-16 0z';
const BEAK_OPEN = 'M51 54q9-6 18 0q-9 14-18 0z';
const BODY = 'M60 6c25 0 42 22 42 54s-17 56-42 56-42-24-42-56S35 6 60 6z';
const SCARF = 'M27 68q33 12 66 0l2 9q-35 13-70 0z';
const SCARF_LOW = 'M27 70q33 12 66 0l2 9q-35 13-70 0z';
const FLIP_L_UP = 'M30 70C20 62 10 48 4 30C2 24 7 22 11 26C18 34 24 44 30 52Z';
const FLIP_R_UP = 'M90 70C100 62 110 48 116 30C118 24 113 22 109 26C102 34 96 44 90 52Z';
const TAIL = 'M76 77l8 17-9 3-5-18z';

const ONCE: Partial<Record<PipMood, number>> = { hello: 2700, yay: 3150, peek: 3600 };

const loop = (frames: Track['frames'], duration: number, easing = ease.inOut, extra: Partial<Track> = {}): Track => ({
  frames,
  duration,
  easing,
  repeat: -1,
  ...extra,
});

const BREATHE: MotionSpec = {
  scaleX: loop([[0, 1], [0.5, 1.015], [1, 1]], 3200),
  scaleY: loop([[0, 1], [0.5, 1.03], [1, 1]], 3200),
};
const BREATHE_SLOW: MotionSpec = {
  scaleX: loop([[0, 1], [0.5, 1.015], [1, 1]], 5000),
  scaleY: loop([[0, 1], [0.5, 1.03], [1, 1]], 5000),
};
const HOP_STOPS = [0, 0.35, 0.62, 0.75, 1] as const;
const hop = (values: readonly number[], then: Track): Track => ({
  frames: HOP_STOPS.map((at, i) => [at, values[i]] as const),
  duration: 900,
  easing: ease.hop,
  repeat: 2,
  springIn: true,
  then,
});
const HOP: MotionSpec = {
  translateY: hop([0, -24, 0, 0, 0], loop([[0, 0], [1, 0]], 3200)),
  scaleX: hop([1.06, 0.96, 1, 1.04, 1.06], BREATHE.scaleX!),
  scaleY: hop([0.94, 1.05, 1, 0.96, 0.94], BREATHE.scaleY!),
};
const tiltSpec = (deg: number): MotionSpec => ({ rotate: loop([[0, -deg], [0.5, deg], [1, -deg]], 2800) });
const PEEK: MotionSpec = {
  translateY: { frames: [[0, 90], [0.22, 0], [0.78, 0], [1, 90]], duration: 3600, easing: ease.peek, repeat: 1 },
};
const SHADOW_HOP: MotionSpec = {
  scale: { frames: [[0, 1], [0.35, 0.6], [0.62, 1], [1, 1]], duration: 900, easing: ease.hop, repeat: 2 },
  opacity: { frames: [[0, 1], [0.35, 0.5], [0.62, 1], [1, 1]], duration: 900, easing: ease.hop, repeat: 2 },
};
const BLINK: MotionSpec = { scaleY: loop([[0, 1], [0.9, 1], [0.93, 0.1], [0.96, 1], [1, 1]], 4200, ease.linear) };
const SWAY: MotionSpec = { rotate: loop([[0, -6], [0.5, 9], [1, -6]], 2400) };
const WAVE: MotionSpec = { rotate: { frames: [[0, -12], [0.5, 16], [1, -12]], duration: 900, easing: ease.inOut, repeat: 3, springIn: true } };
const CHEER_L: MotionSpec = { rotate: { frames: [[0, 0], [0.5, 14], [1, 0]], duration: 900, easing: ease.inOut, repeat: 2, springIn: true } };
const CHEER_R: MotionSpec = { rotate: { frames: [[0, 0], [0.5, -14], [1, 0]], duration: 900, easing: ease.inOut, repeat: 2, springIn: true } };
const DOTS: MotionSpec[] = [0, 200, 400].map((delay) => ({
  opacity: loop([[0, 0.25], [0.5, 1], [1, 0.25]], 1200, ease.inOut, { delay }),
  translateY: loop([[0, 0], [0.5, -4], [1, 0]], 1200, ease.inOut, { delay }),
}));
const ZS: MotionSpec[] = [0, 1500].map((delay) => ({
  opacity: loop([[0, 0], [0.2, 1], [1, 0]], 3000, ease.out, { delay }),
  translateX: loop([[0, 0], [1, 14]], 3000, ease.out, { delay }),
  translateY: loop([[0, 0], [1, -36]], 3000, ease.out, { delay }),
  scale: loop([[0, 0.6], [1, 1.2]], 3000, ease.out, { delay }),
}));
const CONFETTI: MotionSpec[] = [0, 450, 900, 1350].map((delay) => ({
  translateY: loop([[0, -30], [1, 120]], 1800, ease.linear, { delay }),
  rotate: loop([[0, 0], [1, 320]], 1800, ease.linear, { delay }),
  opacity: loop([[0, 0], [0.1, 1], [1, 0]], 1800, ease.linear, { delay }),
}));
const HIDDEN = { opacity: 0 } as const;
const Z_STILL = { translateX: 7, translateY: -18 } as const;

const CONFETTI_PIECES = [
  { x: 8, y: 0, fill: IRIS },
  { x: 100, y: -6, fill: CHEEK },
  { x: 30, y: -14, fill: '#0B7A6C' },
  { x: 84, y: -10, fill: IRIS },
];
const DOT_POINTS = [
  [100, 12],
  [111, 4],
  [122, -4],
] as const;

const tiltCache = new Map<number, MotionSpec>();
function tiltFor(deg: number) {
  let spec = tiltCache.get(deg);
  if (!spec) tiltCache.set(deg, (spec = tiltSpec(deg)));
  return spec;
}

/** Pip, Huddle's penguin. Idle breathes and blinks; other moods play when something happens. */
export function Pip({
  mood = 'idle',
  size = 120,
  scarf = IRIS,
  tail,
  coat = INK,
  beakColor = BEAK,
  crop = 'full',
  shades = false,
  wavePose = false,
  shadow = false,
  tilt = 6,
  replay = 0,
  onSettled,
  accessibilityLabel,
  style,
}: PipProps) {
  const reduced = useReducedMotion();
  const key = `${mood}:${replay}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });

  useEffect(() => {
    const duration = ONCE[mood];
    if (!duration) return;
    const timer = setTimeout(() => {
      setSettledKey(key);
      settledRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [mood, key]);

  const current: PipMood = ONCE[mood] && settledKey === key ? 'idle' : mood;
  const [vx, vy, vw, vh] = VIEWBOX[crop];
  const frame: Frame = { x: vx, y: vy, w: vw, h: vh, width: size, height: (size * vh) / vw };
  const nav = crop === 'peek';
  const bust = crop !== 'full';
  const still = reduced;

  const upL = current === 'yay';
  const upR = current === 'hello' || current === 'yay';
  const open = current === 'hello' || current === 'yay';
  const closed = current === 'snooze';
  const pupils = current === 'hmm' ? { l: 51, r: 75, y: 43 } : current === 'peek' ? { l: 47, r: 71, y: 49 } : { l: 48, r: 72, y: 47 };
  const highlights = size >= 40 && !nav;
  const faceDrop = shades ? 2 : 0;
  const tailColor = tail ?? scarf;

  const rootSpec: MotionSpec | null = still
    ? null
    : current === 'yay'
      ? HOP
      : current === 'hmm'
        ? tiltFor(tilt)
        : current === 'snooze'
          ? BREATHE_SLOW
          : current === 'peek'
            ? PEEK
            : nav
              ? null
              : BREATHE;

  const pivotRoot = [60, 122] as const;
  const eyeWhites = (
    <>
      <Circle cx={46} cy={47} r={16} fill="#fff" />
      <Circle cx={74} cy={47} r={16} fill="#fff" />
    </>
  );

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!accessibilityLabel}
      pointerEvents="none"
      testID={`pip-${current}`}
      style={[{ width: frame.width, height: frame.height }, style]}>
      {current === 'yay' && !bust ? (
        CONFETTI_PIECES.map((c, i) => (
          <Layer key={`c${i}`} frame={frame} pivot={[c.x, c.y]} spec={still ? null : CONFETTI[i]} rest={HIDDEN} runKey={key}>
            <Rect x={c.x} y={c.y} width={7} height={12} rx={2} fill={c.fill} />
          </Layer>
        ))
      ) : null}

      {shadow && !bust ? (
        <Layer frame={frame} pivot={[60, 121]} spec={!still && current === 'yay' ? SHADOW_HOP : null} runKey={key}>
          <Ellipse cx={60} cy={121} rx={30} ry={4} fill="rgba(23, 26, 47, 0.12)" />
        </Layer>
      ) : null}

      <Layer frame={frame} pivot={pivotRoot} spec={rootSpec} runKey={key} svg={false}>
        {!bust ? (
          <StaticLayer frame={frame}>
            <Ellipse cx={45} cy={117} rx={12} ry={5} fill={beakColor} />
            <Ellipse cx={75} cy={117} rx={12} ry={5} fill={beakColor} />
            {!upL ? (
              wavePose ? (
                <Ellipse cx={18} cy={74} rx={8} ry={19} fill={coat} transform="rotate(14 18 74)" />
              ) : (
                <Ellipse cx={20} cy={76} rx={8} ry={19} fill={coat} transform="rotate(14 20 76)" />
              )
            ) : null}
            {!upR ? (
              wavePose ? (
                <Ellipse cx={106} cy={50} rx={8} ry={19} fill={coat} transform="rotate(40 106 50)" />
              ) : (
                <Ellipse cx={100} cy={76} rx={8} ry={19} fill={coat} transform="rotate(-14 100 76)" />
              )
            ) : null}
          </StaticLayer>
        ) : null}

        {upL && !bust ? (
          <Layer frame={frame} pivot={[30, 70]} spec={still ? null : CHEER_L} runKey={key}>
            <Path d={FLIP_L_UP} fill={coat} />
          </Layer>
        ) : null}
        {upR && !bust ? (
          <Layer frame={frame} pivot={[90, 70]} spec={still ? null : current === 'hello' ? WAVE : CHEER_R} runKey={key}>
            <Path d={FLIP_R_UP} fill={coat} />
          </Layer>
        ) : null}

        <StaticLayer frame={frame}>
          <Path d={BODY} fill={coat} />
          {nav ? eyeWhites : null}
          <Ellipse cx={60} cy={80} rx={27} ry={32} fill="#fff" />
          {closed || shades ? eyeWhites : null}
          {closed ? <Path d="M41 48q5 4 10 0M69 48q5 4 10 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" /> : null}
          {shades ? (
            <G>
              <Rect x={34} y={40} width={23} height={14} rx={6} fill={INK} />
              <Rect x={63} y={40} width={23} height={14} rx={6} fill={INK} />
              <Path d="M57 45h6" stroke={INK} strokeWidth={3} />
            </G>
          ) : null}
        </StaticLayer>

        {!closed && !shades ? (
          <Layer frame={frame} pivot={[60, 47]} spec={still ? null : BLINK} runKey={key}>
            {nav ? null : eyeWhites}
            <Circle cx={pupils.l} cy={pupils.y} r={4.5} fill={INK} />
            <Circle cx={pupils.r} cy={pupils.y} r={4.5} fill={INK} />
            {highlights ? (
              <>
                <Circle cx={pupils.l + 1.6} cy={pupils.y - 1.6} r={1.5} fill="#fff" />
                <Circle cx={pupils.r + 1.6} cy={pupils.y - 1.6} r={1.5} fill="#fff" />
              </>
            ) : null}
          </Layer>
        ) : null}

        <StaticLayer frame={frame}>
          <Circle cx={37} cy={57 + faceDrop} r={4.5} fill={CHEEK} />
          <Circle cx={83} cy={57 + faceDrop} r={4.5} fill={CHEEK} />
          <Path d={open ? BEAK_OPEN : shades ? BEAK_SMILE_LOW : BEAK_SMILE} fill={beakColor} />
          {nav ? null : <Path d={shades ? SCARF_LOW : SCARF} fill={scarf} />}
        </StaticLayer>

        {!bust ? (
          <Layer frame={frame} pivot={[70, 77]} spec={still ? null : SWAY} runKey={key}>
            <Path d={TAIL} fill={tailColor} />
          </Layer>
        ) : null}
      </Layer>

      {current === 'hmm' && !bust
        ? DOT_POINTS.map(([cx, cy], i) => (
            <Layer key={`d${i}`} frame={frame} spec={still ? null : DOTS[i]} runKey={key}>
              <Circle cx={cx} cy={cy} r={4} fill={EFFECT} />
            </Layer>
          ))
        : null}

      {current === 'snooze' && !bust
        ? ZS.map((spec, i) =>
            still && i > 0 ? null : (
              <Layer key={`z${i}`} frame={frame} pivot={[92, 7]} spec={still ? null : spec} rest={still ? Z_STILL : HIDDEN} runKey={key}>
                <SvgText x={92} y={20} fontFamily={fonts.display} fontWeight="700" fontSize={i === 0 ? 18 : 14} fill={EFFECT}>
                  z
                </SvgText>
              </Layer>
            ),
          )
        : null}
    </View>
  );
}
