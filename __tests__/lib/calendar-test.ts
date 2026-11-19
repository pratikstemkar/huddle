import { Linking, Platform, Share } from 'react-native';

import { addEventToCalendar, addTripToCalendar, buildEventIcs, buildIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, googleEventUrl, icsFileName } from '@/lib/calendar';
import { photoState } from '../../test-utils/photo-mocks';

const trip = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Goa in March', start: '2027-03-12', end: '2027-03-14', place: 'Palolem Beach' };
const NOW = new Date(Date.UTC(2027, 0, 2, 3, 4, 5, 678));

const octets = (s: string) => new TextEncoder().encode(s).length;

describe('escapeIcsText', () => {
  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:Goa')).toBe('SUMMARY:Goa');
    const exactly75 = 'X'.repeat(75);
    expect(foldIcsLine(exactly75)).toBe(exactly75);
  });

  it('folds at 75 octets, continuation lines starting with a space', () => {
    const folded = foldIcsLine('SUMMARY:' + 'a'.repeat(200));
    const lines = folded.split('\r\n');
    expect(lines.length).toBe(3);
    for (const l of lines) expect(octets(l)).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    // Unfolding gives the original back.
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'a'.repeat(200));
  });

  it('never splits a multi-byte character', () => {
    const text = 'SUMMARY:' + 'é₹🌴'.repeat(30);
    const folded = foldIcsLine(text);
    for (const l of folded.split('\r\n')) expect(octets(l)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(text);
    expect(folded).not.toContain('�');
  });
});

describe('buildIcs', () => {
  it('makes an all-day event with an exclusive end date', () => {
    const ics = buildIcs(trip, NOW);
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Huddle//Huddle trips//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:aaaaaaaa-0000-0000-0000-000000000001@huddle',
      'DTSTAMP:20270102T030405Z',
      'DTSTART;VALUE=DATE:20270312',
      'DTEND;VALUE=DATE:20270315',
      'SUMMARY:Goa in March',
      'LOCATION:Palolem Beach',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('ends the day after a one-day trip, across a month end', () => {
    const ics = buildIcs({ ...trip, start: '2027-02-28', end: '2027-02-28' }, NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270228\r\nDTEND;VALUE=DATE:20270301\r\n');
  });

  it('escapes text and leaves out a missing place', () => {
    const ics = buildIcs({ ...trip, name: 'Goa; beaches, bars\nand more', place: null }, NOW);
    expect(ics).toContain('SUMMARY:Goa\\; beaches\\, bars\\nand more\r\n');
    expect(ics).not.toContain('LOCATION');
  });

  it('uses CRLF everywhere and folds long lines', () => {
    const ics = buildIcs({ ...trip, name: 'A very long trip name '.repeat(5) }, NOW);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const l of ics.split('\r\n')) expect(octets(l)).toBeLessThanOrEqual(75);
  });
});

describe('googleCalendarUrl', () => {
  it('fills in the event with an exclusive end date', () => {
    expect(googleCalendarUrl(trip)).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Goa%20in%20March&dates=20270312/20270315&location=Palolem%20Beach',
    );
  });

  it('leaves out a missing place and encodes the name', () => {
    expect(googleCalendarUrl({ ...trip, name: 'Goa & co', place: undefined })).toBe(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Goa%20%26%20co&dates=20270312/20270315',
    );
  });
});

describe('icsFileName', () => {
  it('slugs the trip name', () => {
    expect(icsFileName('Goa in March!')).toBe('goa-in-march.ics');
    expect(icsFileName('Café Crème')).toBe('cafe-creme.ics');
    expect(icsFileName('🌴🌴')).toBe('trip.ics');
  });
});

describe('addTripToCalendar', () => {
  const os = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    jest.restoreAllMocks();
  });

  it('shares an .ics file on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await addTripToCalendar(trip);
    const uri = `file:///cache/huddle-${trip.id}.ics`;
    expect(share).toHaveBeenCalledWith({ url: uri });
    expect(String(photoState.written.get(uri))).toContain('UID:aaaaaaaa-0000-0000-0000-000000000001@huddle');
  });

  it('opens Google Calendar on Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const share = jest.spyOn(Share, 'share');
    await addTripToCalendar(trip);
    expect(open).toHaveBeenCalledWith(googleCalendarUrl(trip));
    expect(share).not.toHaveBeenCalled();
  });

  it('downloads the .ics on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const link = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
    const g = globalThis as unknown as Record<string, unknown>;
    const prevDocument = g.document;
    const createObjectURL = jest.fn(() => 'blob:ics');
    const revokeObjectURL = jest.fn();
    const prevCreate = URL.createObjectURL;
    const prevRevoke = URL.revokeObjectURL;
    g.document = { createElement: jest.fn(() => link), body: { appendChild: jest.fn() } };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    jest.useFakeTimers();
    try {
      await addTripToCalendar(trip);
      expect(link).toMatchObject({ href: 'blob:ics', download: 'goa-in-march.ics' });
      expect(link.click).toHaveBeenCalled();
      expect(link.remove).toHaveBeenCalled();
      const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
      expect(blob.type).toBe('text/calendar;charset=utf-8');
      jest.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:ics');
    } finally {
      jest.useRealTimers();
      g.document = prevDocument;
      URL.createObjectURL = prevCreate;
      URL.revokeObjectURL = prevRevoke;
    }
  });
});

describe('timed events (hangouts)', () => {
  const event = { id: 'h1', name: 'Dinner; with, the gang', start: new Date(Date.UTC(2027, 0, 8, 13, 30)), end: new Date(Date.UTC(2027, 0, 8, 15, 30)), place: 'Nori House' };

  it('builds a UTC event with an escaped title, the place and a stable UID', () => {
    const ics = buildEventIcs(event, NOW);
    expect(ics).toContain('UID:h1@huddle');
    expect(ics).toContain('DTSTAMP:20270102T030405Z');
    expect(ics).toContain('DTSTART:20270108T133000Z');
    expect(ics).toContain('DTEND:20270108T153000Z');
    expect(ics).toContain('SUMMARY:Dinner\\; with\\, the gang');
    expect(ics).toContain('LOCATION:Nori House');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('assumes one hour when the length is open', () => {
    expect(buildEventIcs({ ...event, end: null }, NOW)).toContain('DTEND:20270108T143000Z');
    expect(googleEventUrl({ ...event, end: null })).toContain('dates=20270108T133000Z/20270108T143000Z');
  });

  it('links Google Calendar with the title, times and place', () => {
    const url = googleEventUrl(event);
    expect(url).toContain('text=Dinner%3B%20with%2C%20the%20gang');
    expect(url).toContain('dates=20270108T133000Z/20270108T153000Z');
    expect(url).toContain('location=Nori%20House');
  });

  it('opens Google Calendar on Android, like trips do', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await addEventToCalendar(event);
    expect(open).toHaveBeenCalledWith(googleEventUrl(event));
    open.mockRestore();
    Platform.OS = original;
  });
});
