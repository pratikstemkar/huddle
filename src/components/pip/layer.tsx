import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { REST, runTrack, type MotionProp, type MotionSpec } from './motion';

export type Frame = { x: number; y: number; w: number; h: number; width: number; height: number };

type Props = {
  frame: Frame;
  /** Pivot in viewBox units. */
  pivot?: readonly [number, number];
  /** Null holds the layer still at `rest`. */
  spec?: MotionSpec | null;
  rest?: Partial<Record<MotionProp, number>>;
  /** Changing it restarts the motion. */
  runKey?: string;
  /** False wraps other layers instead of drawing its own Svg. */
  svg?: boolean;
  children: ReactNode;
};

const PROPS: MotionProp[] = ['translateX', 'translateY', 'scaleX', 'scaleY', 'scale', 'rotate', 'opacity'];
const isTranslate = (p: MotionProp) => p === 'translateX' || p === 'translateY';

/** One moving part of Pip: its own Svg in the shared viewBox, transformed by a wrapping view. */
export function Layer({ frame, pivot, spec, rest, runKey, svg = true, children }: Props) {
  const unit = frame.width / frame.w;
  const tx = useSharedValue(REST.translateX);
  const ty = useSharedValue(REST.translateY);
  const sx = useSharedValue(REST.scaleX);
  const sy = useSharedValue(REST.scaleY);
  const s = useSharedValue(REST.scale);
  const r = useSharedValue(REST.rotate);
  const o = useSharedValue(REST.opacity);

  useEffect(() => {
    const values = { translateX: tx, translateY: ty, scaleX: sx, scaleY: sy, scale: s, rotate: r, opacity: o };
    for (const p of PROPS) {
      const sv = values[p];
      cancelAnimation(sv);
      const track = spec?.[p];
      const u = isTranslate(p) ? unit : 1;
      sv.set(track ? runTrack(track, u) : (rest?.[p] ?? REST[p]) * u);
    }
    return () => {
      for (const p of PROPS) cancelAnimation(values[p]);
    };
  }, [spec, rest, runKey, unit, tx, ty, sx, sy, s, r, o]);

  const animated = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scaleX: sx.value * s.value },
      { scaleY: sy.value * s.value },
      { rotate: `${r.value}deg` },
    ],
  }));

  const origin = pivot ? `${(pivot[0] - frame.x) * unit}px ${(pivot[1] - frame.y) * unit}px` : undefined;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, origin ? { transformOrigin: origin } : null, animated]}>
      {svg ? <StaticLayer frame={frame}>{children}</StaticLayer> : children}
    </Animated.View>
  );
}

export function StaticLayer({ frame, children }: { frame: Frame; children: ReactNode }) {
  return (
    <Svg width={frame.width} height={frame.height} viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} style={styles.svg} pointerEvents="none">
      {children}
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, top: 0, overflow: 'visible' },
});
