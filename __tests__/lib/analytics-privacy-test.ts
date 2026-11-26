import { redactCodes, redactEvent, screenName } from '@/lib/analytics-privacy';

describe('redactCodes', () => {
  it.each([
    ['https://huddletrips.vercel.app/invite/goa2027', 'https://huddletrips.vercel.app/invite/[redacted]'],
    ['huddle://group-invite/college1', 'huddle://group-invite/[redacted]'],
    ['http://localhost:8081/invite/goa2027?ref=chat', 'http://localhost:8081/invite/[redacted]?ref=chat'],
    ['/join?code=goa2027', '/join?code=[redacted]'],
    ['huddle://auth/callback?state=1&code=abc-123', 'huddle://auth/callback?state=1&code=[redacted]'],
    ['Cannot open /invite/goa2027 right now', 'Cannot open /invite/[redacted] right now'],
  ])('hides the code in %s', (text, expected) => {
    expect(redactCodes(text)).toBe(expected);
  });

  it.each(['/invite/[code]', '/group-invite/[code]', '/trip/[id]/invite', '/trip/[id]/invite-people', 'invite join completed'])(
    'leaves %s alone',
    (text) => {
      expect(redactCodes(text)).toBe(text);
    },
  );
});

describe('redactEvent', () => {
  it('cleans nested properties and keeps everything else', () => {
    const timestamp = new Date('2026-11-26T10:00:00Z');
    const event = {
      event: 'Application Opened',
      properties: { url: 'huddle://invite/goa2027', count: 2, list: [{ value: '/join?code=pondy27' }], none: null },
      $set: { email: 'aarav@dev.test' },
      timestamp,
    };

    expect(redactEvent(event)).toEqual({
      event: 'Application Opened',
      properties: { url: 'huddle://invite/[redacted]', count: 2, list: [{ value: '/join?code=[redacted]' }], none: null },
      $set: { email: 'aarav@dev.test' },
      timestamp,
    });
  });
});

describe('screenName', () => {
  it.each([
    [[], '/'],
    [['(app)', '(home)'], '/'],
    [['(app)', 'trip', '[id]', '(tabs)', 'vote'], '/trip/[id]/vote'],
    [['invite', '[code]'], '/invite/[code]'],
  ])('names %j as %s', (segments, expected) => {
    expect(screenName(segments)).toBe(expected);
  });
});
