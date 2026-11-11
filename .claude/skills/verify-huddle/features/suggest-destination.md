# Suggest a destination

`/trip/<id>/suggest` (sheet), opened from the **Where** card on trip detail (`Suggest a place`) or from the Places screen. Fields: `Place name` (required, max 80), `Note` (max 500), `Link`, `Image link`. Links get `https://` added when missing; anything that isn't a web link shows `That doesn't look like a web link.` and nothing is saved. A valid image link shows a preview. Locked trips don't offer the button on Places.

## Driving it

1. As a member, trip detail → `Suggest a place`.
2. Fill `Place name` and an invalid `Link` (`not a link`) → `Add place` → error text, still on `/suggest`.
3. Fix the link (`en.wikipedia.org/wiki/Palolem`) → `Add place` → back on trip detail; Where card lists the place with `0`.
4. DB: `destinations` row has `url = https://en.wikipedia.org/wiki/Palolem`.
5. RLS: a non-member reading `destinations` gets no rows.

## Gotchas

- Migration `20261112000000_destination_checks` also enforces the link/length limits in the database.
- Photo upload isn't built; `Image link` is a pasted URL.

Last proven: 2026-11-11 (Zoya, DB + RLS as Meera).
