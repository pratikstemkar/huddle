# Hide who marked which day

An organiser turns off **Show who marked each day** under Privacy in trip settings (`⋯` on trip detail). With it off, members see only how many people are free each day; each person still sees their own days.

## Sub-features

- Default is on. On: Everyone mode shows a dot per person on each day (3 at most, then `+N`), the day's label ends with `: <names>`, and tapping a day lists people with avatars.
- Off: no dots, no names; tapping a day shows `N of M free` and, if you marked it, `Including you.`
- Enforced by RLS: `availability` select returns other people's rows only while `show_who_marked` is true. Counts come from `day_counts` (kept by a trigger), the trip page's headcount from `marked_member_count(t)`.
- Only organisers can change it (the `organisers edit trips` policy); members don't see the switch.
- Live: marking a day updates `day_counts`, which is streamed, so the heatmap stays live with names hidden.

## Driving it with the built-in browser

| Handle | Kind |
|---|---|
| `Show who marked each day` | switch (settings, organiser only) |
| `<Weekday>, <Month> <day>, N of M free: You, Meera` | day button in Everyone mode when names show |
| `dots-<YYYY-MM-DD>` | test id of a day's dots |

1. Seed trip `Hampi surprise` (organiser Meera; Aarav and Kabir joined) starts hidden. Sign in as Aarav and open Mark my days → Everyone. Days 20–27 from today are shaded and there are no dots.
2. As Aarav, query `availability` for that trip through the REST API with his token: only his rows come back. `day_counts` returns every day.
3. Sign in as Meera, open settings, turn the switch on. Back as Aarav: dots appear and day labels list names.

## Gotchas

- Seed rows are relative to `current_date` and only appear after `db:reset`.
