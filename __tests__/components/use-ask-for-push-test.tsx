import { act, renderHook } from '@testing-library/react-native';

import { useAskForPush } from '@/components/use-ask-for-push';
import { askForPushOnce } from '@/lib/notifications';

jest.mock('@/lib/notifications', () => ({ askForPushOnce: jest.fn() }));

const ask = askForPushOnce as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  ask.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAskForPush', () => {
  it('offers push once the screen has settled', async () => {
    await renderHook(() => useAskForPush());
    expect(ask).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1200));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('waits until there is a reason to ask', async () => {
    const { rerender } = await renderHook(({ when }: { when: boolean }) => useAskForPush(when), { initialProps: { when: false } });
    await act(async () => jest.advanceTimersByTime(5000));
    expect(ask).not.toHaveBeenCalled();
    await rerender({ when: true });
    await act(async () => jest.advanceTimersByTime(1200));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('does nothing if the screen closes first', async () => {
    const { unmount } = await renderHook(() => useAskForPush());
    await unmount();
    await act(async () => jest.advanceTimersByTime(5000));
    expect(ask).not.toHaveBeenCalled();
  });
});
