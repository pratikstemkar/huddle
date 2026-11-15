# Hide who marked which day

An organiser turns off **Show who marked each day** under Privacy in `Trip settings`. With it off, members see only how many people are free each day; each person still sees their own days.

## Sub-features

- Default is on: "Everyone can see whose days are whose." Off: "Everyone sees only how many people are free each day, not who. Each person still sees their own days."
- On: Everyone view shows dots per person (3 at most, then `+N`), day labels end with `: <names>`, and tapping a day lists people with avatars.
- Off: no dots, no names; the hint says "Names are hidden for this trip"; tapping a day shows `<day>: N of M free` and "The organiser has hidden who marked which day.", prefixed with "Including you." if you marked it.
- Enforced by RLS: `availability` select returns other people's rows only while `show_who_marked` is true. Counts come from `day_counts` (kept by a trigger), headcounts from `marked_member_count(t)` and `trip_summaries()`.
- Only organisers can change it; members don't see the switch.
- Live: marking a day updates `day_counts`, which is streamed, so the heatmap stays live with names hidden.

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Show who marked each day` | switch (settings, organiser only) |
| `<Weekday>, <Month> <day>, N of M free: You, Meera` | day button in Everyone view when names show |
| `dots-<YYYY-MM-DD>` | test id of a day's dots |

1. Seed trip `Hampi surprise` (organiser Meera; Aarav and Kabir joined) starts hidden. Sign in as Aarav → Hampi → Vote → `Dates` → `Everyone`. Days +20…+27 are shaded (move with `Next month` if needed) and there are no dots.
2. As Aarav, query `availability` for that trip through the REST API with his token: only his rows come back. `day_counts` returns every day.
3. Sign in as Meera → Hampi → `Trip settings` → turn the switch on. Back as Aarav: dots appear and day labels list names.
4. Put it back: as Meera, switch it off again.

## Gotchas

- Seed rows are relative to `current_date` and only appear after `db:reset`.

Last proven: not yet on the redesigned screens.
