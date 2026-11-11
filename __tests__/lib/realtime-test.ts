import { act, renderHook } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';

import { useTripLive } from '@/lib/realtime';
import { channels, supabase } from '../../test-utils/supabase-mock';

const TRIP = 't1';

function handler(ch: (typeof channels)[number], event: string, table: string) {
  const h = ch.handlers.find((x) => x.filter.event === event && x.filter.table === table);
  if (!h) throw new Error(`no ${event} handler for ${table}`);
  return h;
}

describe('useTripLive', () => {
  let appStateListener: ((s: string) => void) | undefined;
  const removeAppState = jest.fn();
  let appStateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListener = undefined;
    removeAppState.mockReset();
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListener = cb as (s: string) => void;
      return { remove: removeAppState };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    appStateSpy.mockRestore();
  });

  async function setup() {
    const onChange = jest.fn();
    const hook = await renderHook(({ id }: { id: string | undefined }) => useTripLive(id, onChange), { initialProps: { id: TRIP } });
    return { onChange, ...hook, ch: channels[channels.length - 1] };
  }

  it('subscribes to inserts and updates filtered by trip', async () => {
    const { ch } = await setup();
    expect(ch.name).toMatch(/^trip:t1:\d+$/);
    for (const table of ['availability', 'destinations', 'votes', 'trip_members']) {
      expect(handler(ch, 'INSERT', table).filter).toEqual({ event: 'INSERT', schema: 'public', table, filter: 'trip_id=eq.t1' });
    }
    expect(handler(ch, 'UPDATE', 'trips').filter.filter).toBe('id=eq.t1');
    expect(ch.subscribe).toHaveBeenCalledTimes(1);
  });

  it('gives every subscription its own channel name', async () => {
    await setup();
    await setup();
    expect(channels[0].name).not.toBe(channels[1].name);
  });

  it('debounces bursts of changes into one reload', async () => {
    const { ch, onChange } = await setup();
    handler(ch, 'INSERT', 'votes').cb({ old: {} });
    handler(ch, 'INSERT', 'availability').cb({ old: {} });
    handler(ch, 'UPDATE', 'trips').cb({ old: {} });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('only reacts to availability and member deletes for this trip', async () => {
    const { ch, onChange } = await setup();
    handler(ch, 'DELETE', 'availability').cb({ old: { trip_id: 'other' } });
    handler(ch, 'DELETE', 'trip_members').cb({ old: { trip_id: 'other' } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();

    handler(ch, 'DELETE', 'trip_members').cb({ old: { trip_id: TRIP } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    // Old rows without a trip id can't be checked, so they reload to be safe.
    handler(ch, 'DELETE', 'availability').cb({ old: {} });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('only reacts to deletes of this trip', async () => {
    const { ch, onChange } = await setup();
    handler(ch, 'DELETE', 'trips').cb({ old: { id: 'other' } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();
    handler(ch, 'DELETE', 'trips').cb({ old: { id: TRIP } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reloads on any vote or destination delete', async () => {
    const { ch, onChange } = await setup();
    handler(ch, 'DELETE', 'votes').cb({ old: { destination_id: 'x' } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    handler(ch, 'DELETE', 'destinations').cb({ old: { id: 'x' } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('reloads once after the connection comes back', async () => {
    const { ch, onChange } = await setup();
    ch.status!('SUBSCRIBED');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();

    for (const down of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      ch.status!(down);
      ch.status!('SUBSCRIBED');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
    }
    expect(onChange).toHaveBeenCalledTimes(3);

    ch.status!('SUBSCRIBED');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('reloads when the app returns to the foreground', async () => {
    const { onChange } = await setup();
    appStateListener!('background');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();
    appStateListener!('active');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callback', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(({ cb }: { cb: () => void }) => useTripLive(TRIP, cb), { initialProps: { cb: first } });
    await rerender({ cb: second });
    handler(channels[0], 'INSERT', 'votes').cb({ old: {} });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cleans up on unmount and cancels a pending reload', async () => {
    const { ch, onChange, unmount } = await setup();
    handler(ch, 'INSERT', 'votes').cb({ old: {} });
    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch);
    expect(removeAppState).toHaveBeenCalled();
  });

  it('does nothing without a trip id', async () => {
    await renderHook(() => useTripLive(undefined, jest.fn()));
    expect(channels).toHaveLength(0);
  });

  it("doesn't listen to app state on web", async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      await setup();
      expect(appStateSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });
});
