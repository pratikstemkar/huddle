import { fireEvent, render, screen } from '@testing-library/react-native';

import { PRIVACY_CONTACT, PRIVACY_SECTIONS } from '@/lib/privacy';
import { router } from '../../test-utils/expo-router-mock';

jest.mock('expo-router', () => require('../../test-utils/expo-router-mock'));

const PrivacyPolicy = require('@/app/privacy').default as () => React.JSX.Element;

describe('Privacy policy', () => {
  it('shows every section, the update date and how to delete your account', async () => {
    await render(<PrivacyPolicy />);
    expect(screen.getByText('Privacy policy')).toBeTruthy();
    expect(screen.getByText(/^Last updated /)).toBeTruthy();
    for (const s of PRIVACY_SECTIONS) expect(screen.getByText(s.title)).toBeTruthy();
    expect(screen.getByText(/Your profile → Delete account/)).toBeTruthy();
    expect(screen.getByText(new RegExp(PRIVACY_CONTACT.replace('.', '\\.')))).toBeTruthy();
  });

  it('goes back, or home when opened directly', async () => {
    await render(<PrivacyPolicy />);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
