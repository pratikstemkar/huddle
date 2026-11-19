import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmProvider, useConfirm } from '@/components/ui/confirm-sheet';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { ToastProvider, useToast } from '@/components/ui/toast';

describe('Button disabled', () => {
  it('does not fire and is announced as disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" disabled onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('shows the message and retries', async () => {
    const retry = jest.fn();
    await render(<ErrorState message="Check your connection." onRetry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Check your connection.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('has no retry button without a handler', async () => {
    await render(<ErrorState message="Nope" />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});

describe('Loading', () => {
  it('is a labelled progress indicator', async () => {
    await render(<Loading label="Loading trip" />);
    expect(screen.getByRole('progressbar', { name: 'Loading trip' })).toBeTruthy();
  });
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function Trigger() {
    const toast = useToast();
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="go" onPress={() => toast.show('Link copied')}>
        <Text>go</Text>
      </Pressable>
    );
  }

  it('shows a message then hides it', async () => {
    await render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    expect(screen.queryByText('Link copied')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByText('Link copied')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Link copied')).toBeNull();
  });
});

describe('ConfirmSheet', () => {
  function Ask({ onResult }: { onResult: (ok: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="ask" onPress={() => {
          // Not awaited: the handler stays pending until the sheet closes.
          confirm({ title: 'Delete this photo?', destructive: true }).then(onResult);
        }}>
        <Text>ask</Text>
      </Pressable>
    );
  }

  it('resolves true when confirmed and false when cancelled', async () => {
    const onResult = jest.fn();
    await render(
      <ConfirmProvider>
        <Ask onResult={onResult} />
      </ConfirmProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'ask' }));
    expect(screen.getByText('Delete this photo?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {});
    expect(onResult).toHaveBeenLastCalledWith(true);

    await fireEvent.press(screen.getByRole('button', { name: 'ask' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {});
    expect(onResult).toHaveBeenLastCalledWith(false);
  });
});
