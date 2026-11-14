import {
  Easing,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
} from 'react-native-reanimated';

import { springs } from '@/theme/tokens';

export type MotionProp = 'translateX' | 'translateY' | 'scaleX' | 'scaleY' | 'scale' | 'rotate' | 'opacity';

/** One property's keyframes as [fraction 0..1, value] pairs, like a CSS @keyframes block. */
export type Track = {
  frames: readonly (readonly [number, number])[];
  duration: number;
  easing: EasingFunction | EasingFunctionFactory;
  /** -1 loops forever. */
  repeat: number;
  delay?: number;
  /** Spring into the first frame so a replay interrupts whatever was running. */
  springIn?: boolean;
  /** Runs once this track's repeats finish. */
  then?: Track;
};

export type MotionSpec = Partial<Record<MotionProp, Track>>;

export const REST: Record<MotionProp, number> = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, scale: 1, rotate: 0, opacity: 1 };

export const ease: Record<'inOut' | 'out' | 'linear' | 'hop' | 'peek', EasingFunction | EasingFunctionFactory> = {
  inOut: Easing.bezier(0.42, 0, 0.58, 1),
  out: Easing.bezier(0, 0, 0.58, 1),
  linear: Easing.linear,
  hop: Easing.bezier(0.3, 0.7, 0.4, 1),
  peek: Easing.bezier(0.34, 1.4, 0.5, 1),
};

/** Builds the Reanimated animation for a track. `unit` scales translate values from viewBox units to points. */
export function runTrack(track: Track, unit = 1): number {
  const segments = track.frames.slice(1).map(([at, value], i) =>
    withTiming(value * unit, { duration: Math.max(0, (at - track.frames[i][0]) * track.duration), easing: track.easing }),
  );
  const cycle = segments.length === 1 ? segments[0] : withSequence(...segments);
  const looped = withRepeat(cycle, track.repeat);
  const first = track.frames[0][1] * unit;
  const started = track.springIn ? withSequence(withSpring(first, springs.pip), looped) : withSequence(withTiming(first, { duration: 0 }), looped);
  const chained = track.then ? withSequence(started, runTrack(track.then, unit)) : started;
  return track.delay ? withSequence(withTiming(first, { duration: 0 }), withDelay(track.delay, chained)) : chained;
}
