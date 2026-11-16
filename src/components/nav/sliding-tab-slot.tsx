import { useTabSlot } from 'expo-router/ui';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Screen } from 'react-native-screens';

import { useReducedMotion } from '@/theme/use-theme';

const DURATION = 240;
/** How far a screen travels, as a share of the width: a short nudge plus fade, not a full-page swipe. */
const TRAVEL = 0.25;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Which tab is showing and which one it replaced; shared by all screens of one slot. */
type Nav = { cur: number; prev: number };

type SlideProps = {
  index: number;
  isFocused: boolean;
  navRef: MutableRefObject<Nav>;
  /** Side a freshly mounted focused screen starts from (-1, 0, 1). */
  enterDir: number;
  children: ReactNode;
};

/** One tab screen. Stays mounted and visible while it slides out, then hides like any inactive tab. */
function SlideScreen({ index, isFocused, navRef, enterDir, children }: SlideProps) {
  const travel = useWindowDimensions().width * TRAVEL;
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(isFocused);
  const x = useSharedValue(enterDir * travel);

  if (isFocused && !visible) setVisible(true);

  // Layout effects of every screen run before any plain effect, so the effect below sees the new nav.
  // The tab we're entering also jumps to its starting side here, before paint.
  useLayoutEffect(() => {
    if (!isFocused || navRef.current.cur === index) return;
    navRef.current = { cur: index, prev: navRef.current.cur };
    x.set(Math.sign(index - navRef.current.prev) * travel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    const { cur, prev } = navRef.current;
    const dir = isFocused ? Math.sign(index - prev) : Math.sign(index - cur);
    if (isFocused) {
      if (reduced || dir === 0) x.set(0);
      else x.set(withTiming(0, { duration: DURATION, easing: EASE }));
    } else {
      // No motion (reduced motion, or no direction) still goes through a timing so the hide happens in its callback.
      const instant = reduced || dir === 0;
      x.set(withTiming(instant ? 0 : dir * travel, { duration: instant ? 0 : DURATION, easing: EASE }, (done) => {
        if (done) runOnJS(setVisible)(false);
      }));
    }
    // Only a focus change starts a slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(x.get()) / travel) * 0.85,
    transform: [{ translateX: x.get() }],
  }));
  return (
    <Screen enabled activityState={isFocused || visible ? 2 : 0} freezeOnBlur={false} style={[styles.screen, !(isFocused || visible) && styles.hidden]}>
      <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
    </Screen>
  );
}

/** Drop-in for expo-router/ui `<TabSlot />`: switching tabs slides the screens in the direction of travel. */
export function SlidingTabSlot() {
  const navRef = useRef<Nav>({ cur: -1, prev: -1 });
  return useTabSlot({
    renderFn: (descriptor, { index, isFocused, loaded }) => {
      const { lazy = true } = descriptor.options;
      if (!loaded && !isFocused && lazy) return null;
      if (isFocused && navRef.current.cur === -1) navRef.current = { cur: index, prev: index };
      const enterDir = isFocused && navRef.current.cur !== index ? Math.sign(index - navRef.current.cur) : 0;
      return (
        <SlideScreen key={descriptor.route.key} index={index} isFocused={isFocused} navRef={navRef} enterDir={enterDir}>
          {descriptor.render()}
        </SlideScreen>
      );
    },
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: 'relative', height: '100%', overflow: 'hidden' },
  hidden: { display: 'none' },
  fill: { flex: 1 },
});
