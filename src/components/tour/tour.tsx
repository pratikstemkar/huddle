import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { posthog } from '@/config/posthog';
import { forgetToursSeen, loadToursSeen, saveTourSeen, type TourId, type ToursSeen } from '@/lib/tour-seen';
import type { HostView } from './measure';
import type { TourStep } from './steps';
import { TourOverlay } from './tour-overlay';

/** Lets the screen (and a pushed trip's slide-in) settle before the dim comes down. */
const START_DELAY_MS = 700;

type Run = { id: TourId; steps: readonly TourStep[]; index: number };

type TourValue = {
  /** Null until the saved flags are read. */
  seen: ToursSeen | null;
  /** True while a tour is on screen. */
  active: boolean;
  register: (id: string, node: HostView | null) => void;
  start: (id: TourId, steps: readonly TourStep[]) => void;
  /** Both tours play again next time their screen opens. */
  replay: () => void;
};

const TourContext = createContext<TourValue>({
  seen: null,
  active: false,
  register: () => {},
  start: () => {},
  replay: () => {},
});

export function useTour() {
  return useContext(TourContext);
}

/**
 * Wraps the signed-in app and draws the tour over it. Render it around the stack so the overlay
 * covers tab bars and headers alike.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const targets = useRef(new Map<string, HostView>());
  const [seen, setSeen] = useState<ToursSeen | null>(null);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    let live = true;
    loadToursSeen().then((s) => {
      // A replay tapped before storage answered wins.
      if (live) setSeen((now) => now ?? s);
    });
    return () => {
      live = false;
    };
  }, []);

  const register = useCallback((id: string, node: HostView | null) => {
    if (node) targets.current.set(id, node);
    else targets.current.delete(id);
  }, []);

  const start = useCallback((id: TourId, steps: readonly TourStep[]) => {
    if (steps.length === 0) return;
    setRun((now) => now ?? { id, steps, index: 0 });
  }, []);

  const finish = useCallback((r: Run, completed: boolean) => {
    setRun(null);
    setSeen((now) => ({ ...(now ?? { home: false, trip: false }), [r.id]: true }));
    saveTourSeen(r.id);
    posthog?.capture('tour_finished', { tour: r.id, completed, step: r.index + 1, steps: r.steps.length });
  }, []);

  const next = useCallback(() => {
    if (!run) return;
    if (run.index + 1 >= run.steps.length) finish(run, true);
    else setRun({ ...run, index: run.index + 1 });
  }, [run, finish]);

  const skip = useCallback(() => {
    if (run) finish(run, false);
  }, [run, finish]);

  const replay = useCallback(() => {
    setSeen({ home: false, trip: false });
    forgetToursSeen();
  }, []);

  const getTarget = useCallback((id: string) => targets.current.get(id) ?? null, []);

  const value = useMemo(() => ({ seen, active: run !== null, register, start, replay }), [seen, run, register, start, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {run ? (
        <TourOverlay
          step={run.steps[run.index]}
          index={run.index}
          count={run.steps.length}
          getTarget={getTarget}
          onNext={next}
          onSkip={skip}
        />
      ) : null}
    </TourContext.Provider>
  );
}

/**
 * Marks a view as something a tour can point at. Spread the result on the view (a host View or
 * Pressable). Pass undefined to opt out.
 */
export function useTourTarget(id: string | undefined) {
  const { register } = useTour();
  const ref = useCallback(
    (node: HostView | null) => {
      if (id) register(id, node);
    },
    [id, register],
  );
  return { ref, collapsable: false as const };
}

/**
 * Plays a tour once per device, the first time this screen is focused with `ready` (its content
 * loaded). Pass memoised `steps`.
 */
export function useAutoTour(id: TourId, steps: readonly TourStep[], ready: boolean) {
  const { seen, start } = useTour();
  const due = ready && seen !== null && !seen[id];
  useFocusEffect(
    useCallback(() => {
      if (!due) return;
      const t = setTimeout(() => start(id, steps), START_DELAY_MS);
      return () => clearTimeout(t);
    }, [due, id, steps, start]),
  );
}
