import { useLocalSearchParams } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';

const TripIdContext = createContext<string | undefined>(undefined);

/** Shares the trip id from the `trip/[id]` layout, which always has it, with every screen inside. */
export function TripIdProvider({ id, children }: { id: string | undefined; children: ReactNode }) {
  return <TripIdContext.Provider value={id}>{children}</TripIdContext.Provider>;
}

/**
 * The current trip's id. A tab screen opened as the stack's anchor (after a deep link to one of the
 * trip's sheets) gets no route params of its own, so the id comes from the layout above it.
 */
export function useTripId(): string | undefined {
  const fromLayout = useContext(TripIdContext);
  const { id } = useLocalSearchParams<{ id?: string }>();
  return fromLayout ?? id;
}
