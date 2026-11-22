# Locked trip summary

On a locked trip the Trip tab hero turns beak yellow with a countdown (`<n> days to go`, `Tomorrow!`, `Today's the day`, `Day N of M`, `That's a wrap`) and `<range> · <n> people`. Under it, the summary card (`LockedSummary`): the place's photo (`Photo of <place>`), **Where** (title, note, `Open link, <domain>` shown as `<domain> ↗`), **When** (`<start> – <end>` and `Day trip` / `1 night` / `N nights`), the faces with `<n> going · <countdown>`, and two buttons: `Share plan` and `Add to calendar` ([add-to-calendar](add-to-calendar.md)). If the chosen place row is gone, it says "The chosen place is no longer available."

The tiles stay; the Vote tile reads `<place> won`. On the trips list a locked card shows its dates and a countdown tile, and its label ends with the dates.

`Share plan` opens the share sheet on native with "<name> is locked in on Huddle! <dates> · <place>". On web without the Web Share API it copies the text and shows `Copied`. Pip's `Share` (when there's nothing to nudge about) does the same.

## Driving it

Seeded trip `Pondy long weekend` (Aarav organiser; Meera, Kabir, Zoya; invite `pondy27`; locked +40…+42 to Pondicherry).

1. Sign in as Aarav → `find "Pondy long weekend, Planning days"` → open it. The first visit opens the celebration screen; `Close` it.
2. Page text: `40 days to go`, `Where`, `Pondicherry`, the note, `en.wikipedia.org ↗`, `When`, `2 nights`, `4 going · 40 days to go`, `Share plan`, `Add to calendar`; tile `Pondicherry won`.
3. Patch `navigator.clipboard.writeText` into `window.__w`, then `Share plan` → `Copied`; `window.__w` is `Pondy long weekend is locked in on Huddle! <dates> · Pondicherry`.
4. Vote → Places is read-only (vote buttons disabled, no `Suggest a place`); Vote → Dates says "Locked in. Dates are set."

## Gotchas

- The countdown numbers assume the seed ran today.
- Locked trips show the `Planning days` chip on home until the dates are over, then `Done`.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
