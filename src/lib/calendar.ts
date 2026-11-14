import { File, Paths } from 'expo-file-system';
import { Linking, Platform, Share } from 'react-native';

import { addDays, type Day } from './dates';

export type CalendarTrip = { id: string; name: string; start: Day; end: Day; place?: string | null };

const compact = (day: Day) => day.replace(/-/g, '');

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(codePoint: number) {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/**
 * Folds a content line at 75 octets (RFC 5545 3.1): continuation lines start with one space, which
 * counts toward their 75. Never splits a UTF-8 character.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = utf8Length(ch.codePointAt(0)!);
    if (size + n > 75) {
      out.push(current);
      current = ' ';
      size = 1;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n');
}

function stamp(now: Date) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * An all-day calendar event for the trip: DTEND is the day after the last day (it's exclusive), the
 * place goes in LOCATION, and the trip id makes the UID stable so re-adding updates the same event.
 */
export function buildIcs(t: CalendarTrip, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Huddle//Huddle trips//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${t.id}@huddle`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compact(t.start)}`,
    `DTEND;VALUE=DATE:${compact(addDays(t.end, 1))}`,
    `SUMMARY:${escapeIcsText(t.name)}`,
    ...(t.place ? [`LOCATION:${escapeIcsText(t.place)}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** A link that opens Google Calendar with the trip filled in as an all-day event. */
export function googleCalendarUrl(t: CalendarTrip): string {
  const params = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(t.name)}`,
    `dates=${compact(t.start)}/${compact(addDays(t.end, 1))}`,
    ...(t.place ? [`location=${encodeURIComponent(t.place)}`] : []),
  ];
  return `https://calendar.google.com/calendar/render?${params.join('&')}`;
}

/** A file name from the trip name: "Goa in March!" -> "goa-in-march". */
export function icsFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'trip'}.ics`;
}

/**
 * Adds the trip to the person's calendar:
 * - web: downloads `<trip-name>.ics`, which the browser or OS opens in the calendar app.
 * - iOS: writes the .ics to the cache and opens the share sheet, which offers Calendar.
 * - Android: opens Google Calendar (the app, else the browser) with the event filled in. Handing a file
 *   to another app needs expo-sharing, which this build doesn't include.
 */
export async function addTripToCalendar(t: CalendarTrip): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([buildIcs(t)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFileName(t.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  if (Platform.OS === 'ios') {
    const file = new File(Paths.cache, `huddle-${t.id}.ics`);
    if (!file.exists) file.create();
    await file.write(buildIcs(t));
    await Share.share({ url: file.uri });
    return;
  }
  await Linking.openURL(googleCalendarUrl(t));
}
