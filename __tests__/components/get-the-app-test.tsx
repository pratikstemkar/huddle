import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GetTheApp } from '@/components/get-the-app';

const APK = 'https://github.com/pratikstemkar/huddle/releases/download/v1.3.0/huddle-1.3.0.apk';
const assign = jest.fn();
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const realLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');

function visitFrom(userAgent: string) {
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent, maxTouchPoints: 0 }, configurable: true });
}

beforeEach(() => {
  assign.mockReset();
  Object.defineProperty(globalThis, 'location', { value: { assign }, configurable: true });
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ assets: [{ name: 'huddle-1.3.0.apk', browser_download_url: APK }] }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
  if (realLocation) Object.defineProperty(globalThis, 'location', realLocation);
  else delete (globalThis as { location?: unknown }).location;
});

describe('GetTheApp', () => {
  it('on Android: downloads the APK, says how to install it, and can open the app or carry on', async () => {
    visitFrom('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131 Mobile');
    const onWeb = jest.fn();
    await render(<GetTheApp path="invite/goa2027" onContinueOnWeb={onWeb} />);

    expect(screen.getByText('Huddle works best in the app')).toBeTruthy();
    expect(screen.getByText('Installing on Android')).toBeTruthy();
    expect(screen.getByText(/Install anyway/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'On iPhone? Use Huddle on the web' })).toBeNull();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await waitFor(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Download for Android' }));
      expect(assign).toHaveBeenLastCalledWith(APK);
    });

    await fireEvent.press(screen.getByRole('button', { name: 'I already have Huddle: open it' }));
    expect(assign).toHaveBeenLastCalledWith('huddle://invite/goa2027');

    await fireEvent.press(screen.getByRole('button', { name: 'Continue on the web' }));
    expect(onWeb).toHaveBeenCalled();
  });

  it('on iPhone: carries on in the web app, with no APK', async () => {
    visitFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1');
    const onWeb = jest.fn();
    await render(<GetTheApp path="invite/goa2027" onContinueOnWeb={onWeb} />);

    expect(screen.queryByRole('button', { name: 'Download for Android' })).toBeNull();
    expect(screen.queryByText('Installing on Android')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'On iPhone? Use Huddle on the web' }));
    expect(onWeb).toHaveBeenCalled();
  });

  it('on a computer: offers both phones and the web', async () => {
    visitFrom('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131');
    await render(<GetTheApp path="group-invite/book-club" onContinueOnWeb={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Download for Android' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'On iPhone? Use Huddle on the web' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue on the web' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'I already have Huddle: open it' })).toBeNull();
  });
});
