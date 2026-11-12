import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

let mockAuth: { session: unknown; loading: boolean } = { session: null, loading: false };
jest.mock('@/lib/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth,
}));

let mockFontsLoaded = true;
jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  BricolageGrotesque_600SemiBold: 1,
  BricolageGrotesque_700Bold: 2,
  useFonts: () => [mockFontsLoaded],
}));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));

const RootLayout = require('@/app/_layout').default;
const AppLayout = require('@/app/(app)/_layout').default;

const routes = {
  _layout: RootLayout,
  '(app)/_layout': AppLayout,
  '(app)/index': () => <Text>Home screen</Text>,
  '(app)/join': () => <Text>Join screen</Text>,
  '(app)/new-trip': () => <Text>New trip screen</Text>,
  '(app)/trip/[id]/index': () => <Text>Trip screen</Text>,
  '(app)/trip/[id]/days': () => <Text>Days screen</Text>,
  '(app)/trip/[id]/places': () => <Text>Places screen</Text>,
  '(app)/trip/[id]/suggest': () => <Text>Suggest screen</Text>,
  '(app)/trip/[id]/settings': () => <Text>Settings screen</Text>,
  '(app)/trip/[id]/lock': () => <Text>Lock screen</Text>,
  'sign-in': () => <Text>Sign in screen</Text>,
  'invite/[code]': () => <Text>Invite screen</Text>,
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
