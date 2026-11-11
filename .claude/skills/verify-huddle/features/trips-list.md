# Trips list (home)

Home shows "Hey <first name>" and every trip the user created or is a member of, newest first, each as a coloured card with a Planning / Locked in pill.

## Sub-features

- Greeting from `full_name` metadata, falling back to the email prefix.
- Empty state "Start your first trip" when the user has no trips.
- Refetch on focus (returning from `/new-trip` shows the new trip).
- Load error: "Couldn't load your trips. Pull to retry."

## How to get to it (user POV)

Sign in; home is `/`.

## Driving it with the built-in browser

1. Sign in as Kabir (no trips) → `get_page_text` contains `Start your first trip`.
2. Sign out, sign in as Meera → shows `Goa in March` with `Planning` (member, not creator: proves the `is_member` RLS path).
3. Compare the card order and names with `db.mjs trips <email>` — they must match exactly.

## Gotchas

- Trip cards are buttons with labels like `Goa in March, still planning`; pressing one opens the trip (see [trip-detail](trip-detail.md)).
- The user's local DB may hold extra trips (e.g. ones they made by hand); assert against `db.mjs` output, not a hardcoded list.
