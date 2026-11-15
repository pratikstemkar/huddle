# Add to calendar

`Add to calendar` on a locked trip: in the summary card on the Trip tab ([locked-summary](locked-summary.md)) and on the celebration screen ([locked-celebration](locked-celebration.md)). `addTripToCalendar` in `src/lib/calendar.ts`:

- **Web:** downloads `<trip-name>.ics` (the name slugged: "Goa in March!" → `goa-in-march.ics`, at most 40 characters, `trip.ics` if nothing is left).
- **iOS:** writes `huddle-<trip id>.ics` to the cache and opens the share sheet, which offers Calendar.
- **Android:** opens a Google Calendar link with the event filled in (the app, else the browser). Handing over a file would need `expo-sharing`, which this build doesn't include.

The event is all-day: `DTSTART;VALUE=DATE` is the first day, `DTEND` the day after the last (exclusive), `SUMMARY` the trip name, `LOCATION` the place (when there is one), `UID:<trip id>@huddle` so adding it again updates the same event. Text is RFC 5545-escaped and lines are folded at 75 octets. Errors are swallowed; nothing is shown if it fails.

## Driving it (web only)

Don't let the browser actually download a file: intercept it.

1. Sign in as Aarav → open `Pondy long weekend` (`Close` the celebration if it opens).
2. With `javascript_tool`:
   `window.__ics = null; const make = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then((t) => (window.__ics = t)); return make.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; };`
3. Click `Add to calendar` in the summary card, wait 1s.
4. `window.__dl` is `pondy-long-weekend.ics`. `window.__ics` has `BEGIN:VCALENDAR`, `UID:aaaaaaaa-0000-0000-0000-000000000002@huddle`, `DTSTART;VALUE=DATE:<locked_start as YYYYMMDD>`, `DTEND;VALUE=DATE:<locked_end + 1 day>`, `SUMMARY:Pondy long weekend`, `LOCATION:Pondicherry`, and `\r\n` line endings.
5. Repeat from the celebration screen (`/trip/<pondy id>/locked`) → the same file.

## Not covered here

The iOS share sheet and the Android Google Calendar hand-off need a device build. The `.ics` builder itself is unit-tested in `__tests__/lib/calendar-test.ts`.

Last proven: not yet.
