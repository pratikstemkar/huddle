# See overlap: which days suit most people

The **Everyone** tab on `/trip/<id>/days` shades each day by how many members are free (heat colours, darker = more). Your own days have an outline. Tapping a day lists who is free. A "Best days" card lists the days with the most people free (at least 2), merging back-to-back days into ranges, e.g. `Nov 22 · 2 of 2 free`.

Trip detail's **When** card shows the same best days plus "N of M have marked their free days".

## Driving it

1. Two users (e.g. Kabir creates a `PREFIX` trip, Zoya joins with its code) each mark days, overlapping on at least one.
2. Click `Everyone`; `find` a shared day → label ends `2 of 2 free`. Click it → page text has `<Weekday>, <Month> <day>: Kabir, You`.
3. `Best days` card shows the overlap; trip detail's When card shows `Best days so far`.
4. RLS: a non-member (e.g. Meera) reading `availability` for the trip gets no rows.

## Gotchas

- The `Fewer free … More free` legend and the "who is free" line sit below the calendar; read them with `get_page_text` or JS, not a viewport screenshot.
- Live updates are not wired yet (roadmap 15): the other person's change shows after refocus.

Last proven: 2026-11-11 (Kabir + Zoya, DB + RLS as Meera, 375px).
