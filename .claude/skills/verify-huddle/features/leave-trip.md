# Leave a trip

Members open `Trip settings` (the row at the bottom of the Trip tab, sub-line "Leave trip"): "Only <organiser> can change this trip." and a Leave section, "Leaving removes your free days and votes. You can rejoin later with the invite code." `Leave trip` → `Leave "<trip>"?`, your open balance if any ("You still owe ₹600. It stays on the trip's Split." / "You are still owed …"), then `Yes, leave trip` (or `Stay`). They land on `/` and the trip is gone from their list.

Organisers don't get a leave button: the Danger zone says to delete the trip instead, because the database refuses to let the last organiser leave ("The last organiser cannot leave the trip").

## What the database does on leave (`…_leave_trip.sql`, `…_expenses.sql`)

- Deletes the leaver's `availability` and `votes` rows for that trip.
- Places, plan items, expenses, shares, settlements and album photos they added stay. Their name stays visible to the trip's members through the `see people in your trips' money` profile policy, and the Split tab and settle sheet look it up, so they keep their name there.
- Deleting a whole trip still works (the guard skips when the trip row is already gone).

## Driving it

1. Setup (not the thing under test): as Aarav create `<PREFIX>leave`, as Kabir `join_trip` with its code and insert one `availability` day.
2. In the browser sign in as Kabir → open the trip → `Trip settings` → `Leave trip` → `Yes, leave trip` → URL `/`, trip not listed.
3. Query the trip as Aarav: `trip_members` has only Aarav, `availability` is empty.
4. As Aarav, delete his own `trip_members` row → error "The last organiser cannot leave the trip".
5. Balance note: before step 2, have Aarav add an expense split with Kabir ([add-expense](add-expense.md)); the confirmation shows "You still owe ₹…".
6. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- A full page reload of a deep link while signed in can land on `/sign-in` first; use in-app navigation instead of `navigate` to a trip URL.

Last proven: not yet on the redesigned sheet (last run on the old UI: 2026-11-11).
