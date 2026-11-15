import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type PipAction = { label: string; onPress: () => void };

type Ctx = { action: PipAction | null; setPipAction: (action: PipAction | null) => void };

const PipActionContext = createContext<Ctx>({ action: null, setPipAction: () => {} });

export function PipActionProvider({ children }: { children: ReactNode }) {
  const [action, setPipAction] = useState<PipAction | null>(null);
  const value = useMemo(() => ({ action, setPipAction }), [action]);
  return <PipActionContext.Provider value={value}>{children}</PipActionContext.Provider>;
}

export function usePipAction() {
  return useContext(PipActionContext);
}

/**
 * Registers what the Pip button does while this screen is focused, and clears it on blur.
 * Pass a stable `onPress` (e.g. from useCallback) so it isn't re-registered every render.
 */
export function useRegisterPipAction(label: string | null, onPress: (() => void) | null) {
  const { setPipAction } = usePipAction();
  useFocusEffect(
    useCallback(() => {
      if (!label || !onPress) return;
      setPipAction({ label, onPress });
      return () => setPipAction(null);
    }, [label, onPress, setPipAction]),
  );
}
