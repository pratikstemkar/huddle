# See overlap: which days suit most people

Vote tab → `Dates` → `Everyone`: each day is shaded by how many members are free (four heat levels, darker = more; "Fewer free … More free" legend). Your own days have an outline. With names shown, a day shows a dot per person and its label ends with `: <names>`. Tapping a day opens a card: `<Weekday>, <Month> <day>: N of M free` (or `nobody is free`) and who, with avatars.

The `Best days` card above the calendar lists up to three ranges with at least 2 people free, back-to-back days merged, e.g. `Nov 22 – 25 · 2 of 2 free`, the first with a `Leading` badge. Otherwise "Nobody has marked a day yet." or "No day suits two or more people yet."

The Trip tab hero shows the first best range with `Best days so far · <k> of <n> marked`, and the lock sheet offers the best ranges as choices.

## Driving it

1. Seeded Goa: Aarav free +10…+16, Meera +13…+19. Sign in as Aarav → Goa → hero shows the +13…+16 range.
2. Vote → `Dates` → `Everyone`. The Best days card lists that range `· 2 of 2 free` with `Leading`.
3. `find` a shared day → its label ends `, 2 of 2 free: You, Meera` (order is the order they marked). Click it → the card shows `<Weekday>, <Month> <day>: 2 of 2 free` and `You`, `Meera`.
4. RLS: a non-member (e.g. Kabir or Zoya) reading `availability` for the Goa trip gets no rows.

## Gotchas

- The legend and the day card sit below the calendar; read them with `get_page_text`, not a viewport screenshot.
- If the seed is older than ~10 days, the Goa days may have moved into the past or another month; use `Next month`, or a fresh `PREFIX` trip with two users.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-11).
