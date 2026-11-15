# Trips list (home)

The Trips tab (`/`) shows "Hey <first name>", "Where to next?", Pip's hero card, then "Your trips": every trip the user created or is a member of, newest first. The home tab bar has `Trips`, `Invites`, `You` and the Pip button (`Pip: start a new trip`).

## Pip's hero card (`homeHero` in `src/app/(app)/(home)/index.tsx`)

The first rule that matches any trip wins:

1. A planning trip with 2+ members, no fixed dates, where someone hasn't marked days: "<k> of <n> still need to mark their days for <trip>." + `Nudge them` ([nudge](nudge.md)).
2. A planning trip with places I haven't voted on: "Got a favourite for <trip>? <leader> is ahead." (or "Voting is open.") + `Vote` → `/trip/<id>/vote?seg=places`.
3. A trip with dates still ahead: "<trip> is <n> days away. Start packing." + `Open`.
4. No trips: "No trips yet. Start one and I'll round up the gang." + `Start a trip` and `Join with a code`.
5. Otherwise: "Got another trip in mind? I'll round up the gang." + `Start a trip`.

## Trip cards

- Label: `<name>, <chip>` plus `, <start> – <end>` when the trip has dates (locked, else fixed), e.g. `Pondy long weekend, Planning days, <dates>`.
- Second line: the date range or `Dates open`, then `Just you` or `<n> friends`.
- Chip (`homeChip` in `src/lib/trip-status.ts`): `Done` (dates over; ` · N photos` when it has photos), `Your vote needed` (planning, and I haven't marked days on a vote-dates trip or haven't voted while places exist), `Planning days` (has dates, not over), else `Voting open`.
- Tile: a countdown (`<n> days` or `Now on trip`) when the dates are ahead or under way, else the top place's photo, else the trip colour with an icon.

## Sub-features

- Greeting from the profile's `display_name`, falling back to `full_name` metadata or the email prefix.
- Empty state: "Start your first trip" card under the hero.
- Refetch on focus (returning from `/new-trip` shows the new trip).
- Load error: "Couldn't load your trips. Check your connection and try again." (it retries on focus).

## Driving it with the built-in browser

1. Sign in as Meera → `get_page_text` lists Goa in March, Pondy long weekend, Hampi surprise and Coorg weekend. The hero says "Pondy long weekend is 40 days away. Start packing." (40 if the seed ran today) with `Open` (Goa: everyone marked and voted; Hampi: no places).
2. `find "Coorg weekend, Done"` → one card. `find "Goa in March, Voting open"` → one card (no dates yet).
3. Sign out, sign in as Aarav → `find "Udaipur in winter, Your vote needed"` → one card (fixed dates, places, no vote from Aarav). The hero says "Got a favourite for Udaipur in winter? Lake Pichola is ahead." with `Vote` (Udaipur has fixed dates, so the mark-days nudge skips it).
4. Compare the card names with `db.mjs trips <email>` — they must match exactly.

The empty state needs a user with no trips; every seeded user has some. Use a user on an isolated stack, or trust `__tests__/app/home-test.tsx`.

## Gotchas

- Seeded trips are all inserted in one transaction, so their `created_at` ties and the order among them isn't fixed. Assert names, not order.
- The user's local DB may hold extra trips (e.g. ones they made by hand); assert against `db.mjs` output, not a hardcoded list. Extra trips can also change which hero rule wins.
- Chips and Pip's line come from `trip_summaries()` and `trip_stats`; if those fail the cards keep their last chips.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
