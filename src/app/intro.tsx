import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { FeaturePage, NotifyPage, ReadyPage, SkyPage, type PagerProps } from '@/components/intro/intro-page';
import { NotifyPreview, PhotosPreview, PlanPreview, SplitPreview, VotePreview } from '@/components/intro/previews';
import { saveJoinAfterSignIn, useIntroSeen } from '@/lib/intro-seen';
import { requestPushPermission, shouldOfferPush } from '@/lib/notifications';
import { tripColors } from '@/theme/tokens';
import { useReducedMotion, useTheme } from '@/theme/use-theme';

/** Hello and the four features come first; the notifications page (phones that haven't been asked) and Ready follow. */
const FEATURES = 5;

/** First open: Pip shows a signed-out newcomer what Huddle does, one page at a time, then hands over to sign in. */
export default function Intro() {
  const { scheme } = useTheme();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const { markSeen } = useIntroSeen();
  const scroller = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState(0);
  // Off until the check says this phone can still be asked, so a granted or web device keeps six pages.
  const [offerPush, setOfferPush] = useState(false);
  const [asking, setAsking] = useState(false);
  // Someone who pressed Skip still sees the notifications page, then goes straight to sign in.
  const skipped = useRef(false);
  const COUNT = FEATURES + (offerPush ? 1 : 0) + 1;
  const NOTIFY = FEATURES;
  const READY = COUNT - 1;

  useEffect(() => {
    let live = true;
    shouldOfferPush().then((offer) => {
      if (live) setOfferPush(offer);
    });
    return () => {
      live = false;
    };
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // The page under the middle of the screen is the current one, whether it got there by Next or a swipe.
  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (now, before) => {
      if (before !== null && now !== before) runOnJS(setIndex)(Math.max(0, Math.min(COUNT - 1, now)));
    },
    [width, COUNT],
  );

  const goTo = useCallback(
    (page: number) => {
      const target = Math.max(0, Math.min(COUNT - 1, page));
      scroller.current?.scrollTo({ x: target * width, animated: !reduced });
      // The scroll event sets the index too; set it now so the page is current even before the slide ends.
      setIndex(target);
    },
    [width, reduced, COUNT],
  );

  // A rotation or a resized browser window keeps the same page in view.
  useEffect(() => {
    scroller.current?.scrollTo({ x: index * width, animated: false });
    // Only when the width changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, [index]);

  // Android's back button steps back through the pages before it leaves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, goTo]);

  const finish = useCallback(
    (join = false) => {
      if (join) saveJoinAfterSignIn();
      router.replace('/sign-in');
      markSeen();
    },
    [markSeen],
  );

  const pager = (i: number): PagerProps => ({ index: i, count: COUNT, width, height, scrollX, active: index === i });
  const back = () => goTo(index - 1);
  const next = () => goTo(index + 1);
  const skip = () => {
    if (offerPush && index < NOTIFY) {
      skipped.current = true;
      goTo(NOTIFY);
    } else finish();
  };
  const afterNotify = () => {
    if (skipped.current) finish();
    else goTo(READY);
  };
  const allow = async () => {
    if (asking) return;
    setAsking(true);
    await requestPushPermission();
    setAsking(false);
    // Move on whatever they answered; coming Back and pressing again just reads the answer, no second prompt.
    afterNotify();
  };

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <StatusBar style={index === 0 || scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.ScrollView
        ref={scroller}
        testID="intro-pager"
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.root}>
        <SkyPage
          {...pager(0)}
          title="Trips with your people, minus the group-chat chaos"
          body="I’m the penguin who keeps the plan moving. Let me show you what your group can do in Huddle."
          onNext={next}
          onSkip={skip}
          onHaveAccount={skip}
        />
        <FeaturePage
          {...pager(1)}
          title="Pick when and where, together"
          preview={<VotePreview />}
          pip={{ mood: 'hmm', scarf: tripColors.iris }}
          says="Everyone taps the days they’re free and backs the places they like. I find the days that suit most of you and show what’s leading."
          onBack={back}
          onNext={next}
          onSkip={skip}
        />
        <FeaturePage
          {...pager(2)}
          title="Plan every day, or just a quick hangout"
          preview={<PlanPreview />}
          pip={{ mood: 'idle', scarf: tripColors.coral }}
          says="Add plans to each day so nobody asks “so what’s next?”. Just want dinner with friends? Start a hangout and pick a time."
          onBack={back}
          onNext={next}
          onSkip={skip}
        />
        <FeaturePage
          {...pager(3)}
          title="Split costs without the maths"
          preview={<SplitPreview />}
          pip={{ mood: 'idle', scarf: tripColors.mint, shades: true }}
          says="Add what you paid and I split it fairly. At the end I show the fewest payments to settle up."
          onBack={back}
          onNext={next}
          onSkip={skip}
        />
        <FeaturePage
          {...pager(4)}
          title="Every photo in one shared album"
          preview={<PhotosPreview />}
          pip={{ mood: 'idle', scarf: tripColors.blush, wavePose: true }}
          says="No more “send me that photo”. Everyone adds their shots to the trip and I sort them by day."
          onBack={back}
          onNext={next}
          onSkip={skip}
        />
        {offerPush ? (
          <NotifyPage
            {...pager(NOTIFY)}
            title="Know the moment the plan moves"
            preview={<NotifyPreview />}
            says="Trips come together fast. I’ll ping you when you’re invited, when the dates lock, and when the group is waiting on your vote. Only the things that need you."
            busy={asking}
            onBack={() => {
              skipped.current = false;
              back();
            }}
            onAllow={allow}
            onLater={afterNotify}
          />
        ) : null}
        <ReadyPage
          {...pager(READY)}
          title="Ready when your people are"
          says="Start a trip and send the link. Save your regulars as a group, and I’ll nudge anyone who hasn’t voted, so you don’t have to."
          onBack={back}
          onStart={() => finish()}
          onInvite={() => finish(true)}
        />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
