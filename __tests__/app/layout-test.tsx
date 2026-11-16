import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useRegisterPipAction } from '@/components/nav/pip-action';

let mockAuth: { session: unknown; loading: boolean } = { session: null, loading: false };
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth,
}));

let mockFontsLoaded = true;
jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  BricolageGrotesque_600SemiBold: 1,
  BricolageGrotesque_700Bold: 2,
  BricolageGrotesque_800ExtraBold: 3,
  useFonts: () => [mockFontsLoaded],
}));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));

const RootLayout = require('@/app/_layout').default;
const AppLayout = require('@/app/(app)/_layout').default;
const HomeTabsLayout = require('@/app/(app)/(home)/_layout').default;
const TripLayout = require('@/app/(app)/trip/[id]/_layout').default;
const TripTabsLayout = require('@/app/(app)/trip/[id]/(tabs)/_layout').default;

const askPip = jest.fn();
function VoteStub() {
  useRegisterPipAction('Suggest a place', askPip);
  return <Text>Vote screen</Text>;
}

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/(home)/_layout': HomeTabsLayout,
  '(app)/(home)/index': () => <Text>Home screen</Text>,
  '(app)/(home)/join': () => <Text>Join screen</Text>,
  '(app)/(home)/profile': () => <Text>Profile screen</Text>,
  '(app)/new-trip': () => <Text>New trip screen</Text>,
  '(app)/delete-account': () => <Text>Delete account screen</Text>,
  '(app)/trip/[id]/_layout': TripLayout,
  '(app)/trip/[id]/(tabs)/_layout': TripTabsLayout,
  '(app)/trip/[id]/(tabs)/index': () => <Text>Trip screen</Text>,
  '(app)/trip/[id]/(tabs)/vote': VoteStub,
  '(app)/trip/[id]/(tabs)/plan': () => <Text>Plan screen</Text>,
  '(app)/trip/[id]/(tabs)/split': () => <Text>Split screen</Text>,
  '(app)/trip/[id]/(tabs)/photos': () => <Text>Photos screen</Text>,
  '(app)/trip/[id]/days': () => <Text>Days screen</Text>,
  '(app)/trip/[id]/places': () => <Text>Places screen</Text>,
  '(app)/trip/[id]/suggest': () => <Text>Suggest screen</Text>,
  '(app)/trip/[id]/settings': () => <Text>Settings screen</Text>,
  '(app)/trip/[id]/lock': () => <Text>Lock screen</Text>,
  'sign-in': () => <Text>Sign in screen</Text>,
  'invite/[code]': () => <Text>Invite screen</Text>,
  privacy: () => <Text>Privacy screen</Text>,
};

describe('Root layout', () => {
  beforeEach(async () => {
    mockAuth = { session: null, loading: false };
    mockFontsLoaded = true;
    await AsyncStorage.clear();
  });

  it('lets signed-out people open an invite link', async () => {
    await renderRouter(routes, { initialUrl: '/invite/goa2027' });
    expect(screen.getByText('Invite screen')).toBeTruthy();
    expect(screen).toHavePathname('/invite/goa2027');
  });

  it('opens the join sheet with the saved invite once signed in', async () => {
    await AsyncStorage.setItem('huddle.pendingInvite', 'goa2027');
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Join screen')).toBeTruthy();
    expect(screen).toHavePathnameWithParams('/join?code=goa2027');
    expect(await AsyncStorage.getItem('huddle.pendingInvite')).toBeNull();
  });

  it('stays home after sign-in when there is no saved invite', async () => {
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('Home screen')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('sends signed-out people to sign in', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('Sign in screen')).toBeTruthy();
    expect(screen).toHavePathname('/sign-in');
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('keeps signed-out people out of trips, even from a link', async () => {
    await renderRouter(routes, { initialUrl: '/trip/abc' });
    expect(screen.queryByText('Trip screen')).toBeNull();
    expect(screen.getByText('Sign in screen')).toBeTruthy();
  });

  it('shows the app when signed in', async () => {
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByText('Home screen')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('opens deep links when signed in', async () => {
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    await renderRouter(routes, { initialUrl: '/join?code=goa2027' });
    expect(screen.getByText('Join screen')).toBeTruthy();
    expect(screen).toHavePathnameWithParams('/join?code=goa2027');
  });

  it('keeps signed-in people off the sign-in screen', async () => {
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    await renderRouter(routes, { initialUrl: '/sign-in' });
    expect(screen.queryByText('Sign in screen')).toBeNull();
  });

  it.each([
    ['the session is loading', { session: null, loading: true }, true],
    ['fonts are loading', { session: null, loading: false }, false],
  ])('keeps the splash screen up while %s', async (_, auth, fonts) => {
    mockAuth = auth;
    mockFontsLoaded = fonts;
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.queryByText('Sign in screen')).toBeNull();
    expect(screen.queryByText('Home screen')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});

describe('Tab bars', () => {
  beforeEach(async () => {
    mockAuth = { session: { user: { id: 'u1' } }, loading: false };
    mockFontsLoaded = true;
    askPip.mockClear();
    await AsyncStorage.clear();
  });

  it('switches between the main tabs and keeps their URLs', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByRole('tab', { name: 'Trips' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Invites' }));
    expect(await screen.findByText('Join screen')).toBeTruthy();
    expect(screen).toHavePathname('/join');
    expect(screen.getByRole('tab', { name: 'Invites' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'You' }));
    expect(await screen.findByText('Profile screen')).toBeTruthy();
    expect(screen).toHavePathname('/profile');
  });

  it('starts a new trip from the Pip button on the main tabs', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'New trip' }));
    expect(await screen.findByText('New trip screen')).toBeTruthy();
    expect(screen).toHavePathname('/new-trip');
  });

  it('tells people what the Pip button does with a bubble and a + badge', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByTestId('pip-hint', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('New trip', { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows the focused trip screen's Pip label in the bubble", async () => {
    await renderRouter(routes, { initialUrl: '/trip/abc' });
    expect(screen.queryByTestId('pip-hint', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Vote' }));
    expect(await screen.findByText('Vote screen')).toBeTruthy();
    expect(screen.getByTestId('pip-hint', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Suggest a place', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the trip tabs and moves between them', async () => {
    await renderRouter(routes, { initialUrl: '/trip/abc' });
    expect(screen.getByText('Trip screen')).toBeTruthy();
    for (const name of ['Trip', 'Vote', 'Plan', 'Split', 'Photos']) expect(screen.getByRole('tab', { name })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Plan' }));
    expect(await screen.findByText('Plan screen')).toBeTruthy();
    expect(screen).toHavePathname('/trip/abc/plan');
  });

  it("runs the focused tab's Pip action, and does nothing harmful without one", async () => {
    await renderRouter(routes, { initialUrl: '/trip/abc' });
    await fireEvent.press(screen.getByRole('button', { name: 'Ask Pip' }));
    expect(askPip).not.toHaveBeenCalled();
    expect(screen.getByText('Trip screen')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Vote' }));
    expect(await screen.findByText('Vote screen')).toBeTruthy();
    expect(screen).toHavePathname('/trip/abc/vote');
    await fireEvent.press(screen.getByRole('button', { name: 'Ask Pip' }));
    expect(askPip).toHaveBeenCalledTimes(1);
  });

  it('opens trip sheets over the tabs', async () => {
    await renderRouter(routes, { initialUrl: '/trip/abc/suggest' });
    expect(screen.getByText('Suggest screen')).toBeTruthy();
    expect(screen).toHavePathname('/trip/abc/suggest');
  });
});
