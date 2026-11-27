import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';

import { Pip } from '@/components/pip/pip';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, shadow, space } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';
import { measureInWindow, type HostView, type Rect } from './measure';
import type { TourStep } from './steps';

/** Room between the target and the spotlight's edge. */
const PAD = 6;
/** Room between the spotlight and the bubble. */
const GAP = 14;
const EDGE = space.lg;
const MAX_BUBBLE = 360;
const TAIL = 14;

type Props = {
  step: TourStep;
  index: number;
  count: number;
  getTarget: (id: string) => HostView | null;
  onNext: () => void;
  onSkip: () => void;
};

/** A rounded rectangle path, drawn the opposite way round so `evenodd` cuts it out of the dim. */
function holePath({ x, y, w, h }: Rect, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** The dim with a spotlight on one control, and Pip's bubble saying what it does. */
export function TourOverlay({ step, index, count, getTarget, onNext, onSkip }: Props) {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const root = useRef<HostView>(null);
  // Which step and window size the spotlight was measured for; stale until the new measure lands.
  const key = `${index}:${step.target}:${width}x${height}`;
  const [found, setFound] = useState<{ key: string; rect: Rect } | null>(null);
  const rect = found?.key === key ? found.rect : null;
  const last = index === count - 1;

  // Find the target each step (and after a rotate or resize). Off screen or gone: skip the step.
  useEffect(() => {
    let live = true;
    const node = getTarget(step.target);
    const host = root.current;
    if (!node || !host) {
      onNext();
      return;
    }
    Promise.all([measureInWindow(host), measureInWindow(node)]).then(([r, t]) => {
      if (!live) return;
      const at = { x: t.x - r.x, y: t.y - r.y, w: t.w, h: t.h };
      const visible = at.w > 0 && at.h > 0 && at.y >= 0 && at.y + at.h <= height && at.x + at.w > 0 && at.x < width;
      if (visible) setFound({ key, rect: at });
      else onNext();
    });
    return () => {
      live = false;
    };
    // onNext changes with the step; the step itself is what should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, getTarget]);

  useEffect(() => {
    if (rect) AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}. Step ${index + 1} of ${count}.`);
  }, [rect, step, index, count]);

  // Android back closes the tour instead of leaving the screen behind it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onSkip();
      return true;
    });
    return () => sub.remove();
  }, [onSkip]);

  const advance = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onNext();
  };

  const hole = rect && { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  const r = hole ? Math.min(radius.lg, hole.w / 2, hole.h / 2) : 0;
  const bubbleWidth = Math.min(width - EDGE * 2, MAX_BUBBLE);
  const cx = hole ? hole.x + hole.w / 2 : width / 2;
  const left = Math.max(EDGE, Math.min(cx - bubbleWidth / 2, width - EDGE - bubbleWidth));
  const above = hole ? hole.y + hole.h / 2 > height / 2 : false;
  const place = hole ? (above ? { bottom: height - hole.y + GAP } : { top: hole.y + hole.h + GAP }) : null;
  const tailLeft = Math.max(radius.lg, Math.min(cx - left - TAIL / 2, bubbleWidth - radius.lg - TAIL));

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(200)}
      exiting={reduced ? undefined : FadeOut.duration(160)}
      accessibilityViewIsModal
      aria-modal
      testID="tour-overlay"
      style={StyleSheet.absoluteFill}>
      <View ref={root} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
      <Pressable accessible={false} onPress={advance} style={StyleSheet.absoluteFill}>
        {hole ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Path d={`M0 0H${width}V${height}H0Z${holePath(hole, r)}`} fill={colors.overlay} fillRule="evenodd" />
            <SvgRect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={r} fill="none" stroke={colors.beak} strokeWidth={2.5} />
          </Svg>
        ) : null}
      </Pressable>

      {hole && place ? (
        <Animated.View
          key={step.target}
          entering={reduced ? undefined : FadeIn.duration(180)}
          testID="tour-bubble"
          style={[
            styles.bubble,
            place,
            { left, width: bubbleWidth, backgroundColor: colors.card, borderColor: colors.line, boxShadow: shadow[scheme].nav },
          ]}>
          <View
            pointerEvents="none"
            style={[
              styles.tail,
              { left: tailLeft, backgroundColor: colors.card, borderColor: colors.line },
              above ? styles.tailBelow : styles.tailAbove,
            ]}
          />
          <View style={styles.body}>
            <Pip size={44} mood={index === 0 ? 'hello' : 'idle'} style={styles.pip} />
            <View style={styles.copy}>
              <Text variant="cardTitle" accessibilityRole="header">
                {step.title}
              </Text>
              <Text variant="callout" tone="secondary">
                {step.text}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <View style={styles.dots} aria-hidden>
              {Array.from({ length: count }, (_, i) => (
                <View
                  key={i}
                  style={[styles.dot, { backgroundColor: i === index ? colors.iris : colors.line }, i === index && styles.dotOn]}
                />
              ))}
            </View>
            {last ? null : <Button size="sm" variant="ghost" label="Skip tour" onPress={onSkip} />}
            <Button
              size="sm"
              label={last ? 'Got it' : 'Next'}
              accessibilityHint={last ? 'Ends the tour' : `Step ${index + 2} of ${count}`}
              onPress={advance}
            />
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: space.md },
  tail: { position: 'absolute', width: TAIL, height: TAIL, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  // Only the two outer edges of the rotated square show, so it reads as a point on the bubble.
  tailAbove: { top: -TAIL / 2, borderRightWidth: 0, borderBottomWidth: 0 },
  tailBelow: { bottom: -TAIL / 2, borderLeftWidth: 0, borderTopWidth: 0 },
  body: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pip: { flexShrink: 0 },
  copy: { flex: 1, gap: space.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 16 },
});
