-- One row of numbers per trip for the trip cards on the Trip and Home screens.
-- Runs as the caller (security_invoker), so RLS limits it to the caller's own trips and their rows.
--
-- planned_days: the trip's days (locked dates, else fixed dates) that have at least one plan item.
-- my_net_minor: what the caller is owed (positive) or owes (negative), using the same sign convention
--   as computeBalances() in src/lib/split.ts. Shares and settlements with a deleted person are skipped.

create view public.trip_stats with (security_invoker = true) as
select
  t.id as trip_id,
  (
    select coalesce(array_agg(distinct i.day order by i.day), '{}'::date[])
    from public.itinerary_items i
    where i.trip_id = t.id
      and i.day between coalesce(t.locked_start, t.fixed_start) and coalesce(t.locked_end, t.fixed_end)
  ) as planned_days,
  (select count(*)::int from public.trip_photos p where p.trip_id = t.id) as photo_count,
  (select count(distinct p.uploaded_by)::int from public.trip_photos p where p.trip_id = t.id) as photo_people,
  (select count(*)::int from public.trip_photos p where p.trip_id = t.id and p.uploaded_by = auth.uid()) as my_photos,
  (select coalesce(sum(e.amount_minor), 0)::bigint from public.expenses e where e.trip_id = t.id) as spent_minor,
  (
    coalesce((
      select sum(s.share_minor) from public.expense_shares s join public.expenses e on e.id = s.expense_id
      where e.trip_id = t.id and e.paid_by = auth.uid() and s.user_id is not null and s.user_id <> auth.uid()
    ), 0)
    - coalesce((
      select sum(s.share_minor) from public.expense_shares s join public.expenses e on e.id = s.expense_id
      where e.trip_id = t.id and s.user_id = auth.uid() and e.paid_by is not null and e.paid_by <> auth.uid()
    ), 0)
    + coalesce((
      select sum(x.amount_minor) from public.settlements x
      where x.trip_id = t.id and x.from_user = auth.uid() and x.to_user is not null
    ), 0)
    - coalesce((
      select sum(x.amount_minor) from public.settlements x
      where x.trip_id = t.id and x.to_user = auth.uid() and x.from_user is not null
    ), 0)
  )::bigint as my_net_minor
from public.trips t;

grant select on public.trip_stats to authenticated;
