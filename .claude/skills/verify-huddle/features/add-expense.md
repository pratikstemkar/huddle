# Add an expense (Split tab)

`/trip/<id>/split`: header `<trip> · <₹ spent> spent`, "Split" and `Add expense` (also `Ask Pip`). With nothing spent: Pip and "No expenses yet. Add the first one and Huddle does the maths." Otherwise:

- The balance card: `You're owed ₹…` / `You owe ₹…` / `You're all square`, with `Settle up` when you're not square ([settle-up](settle-up.md)).
- Your lines, two to a row: `<name> owes you ₹…`, `You owe <name> ₹…` (simplified debts: the biggest debtor pays the biggest creditor first, so a line can link two people who never shared an expense).
- The feed, newest first: expenses `<title>, <amount>, <who> paid · split N ways` (or `· just <name>`), and payments `<A> paid <B>, <amount>, settled up`. Expenses are buttons (`Edit expense`) for their author and organisers; your own payments are buttons (`Undo this payment`).

The Trip tab's Split tile shows the same balance; on a locked trip Pip nudges "You owe <name> ₹…. Settle up?" with `Split`.

## Expense sheet (`/trip/<id>/expense`, `?expense=<id>` to edit)

"Add expense" / "Edit expense": `Amount` (₹, decimals allowed, `1,250.50` works), `What for` (max 60), Category `Stay` / `Travel` / `Food` / `Other` (default Other), "Paid by" chips (`Paid by You`, `Paid by <name>`; default you), "Split between" chips (`Split with <name>`; default everyone), and a preview (`split 3 ways · ₹400 each`, `just you · ₹…`, `split 3 ways · ₹333.33–₹333.34 each`). `Save expense`; editing adds `Delete expense` (confirm "Delete this expense? It comes off everyone's balances. This can't be undone.").

Errors: "Enter an amount, like 1,250.", "Say what it was for.", "Pick at least one person to split with.", "Someone in the split has left the trip. Untick them and try again.", "You can only edit expenses you added.", "Couldn't save the expense. Check your connection and try again." People who left but are on the expense being edited stay as chips.

## What the database does (`…_expenses.sql`)

- Writes go only through `save_expense(t, expense, title, category, amount_minor, paid_by, split_with)`: it checks membership, splits equally in SQL (the remainder goes one paisa each to the first people by user id), and replaces the shares on edit. Only the author or an organiser can edit; author or organiser deletes.
- Amounts are integer paise, `0 < amount ≤ 100000000000`. `trips.currency` defaults to `INR` and has no UI.
- Leavers keep their place in the money. Deleting an account nulls them, which writes off their debts pair by pair.

## Driving it

1. Setup: Aarav creates `<PREFIX>split`; Kabir joins with its code (UI or supabase-js).
2. Sign in as Aarav → trip → `Split` tab → empty state. `Add expense` → URL `/trip/<id>/expense`.
3. `Save expense` empty → the amount and title errors. Type `1200` in `Amount`, `Dinner` in `What for`, click `Food`; the preview reads `split 2 ways · ₹600 each`. `Save expense` → back on Split.
4. Text: `· ₹1,200 spent`, `You're owed ₹600`, `Settle up`, `Kabir owes you ₹600`, and `Dinner, ₹1,200, You paid · split 2 ways`. The Trip tab tile says `You're owed ₹600`.
5. DB (psql select): `expenses` row with `amount_minor = 120000`, `category = food`; two `expense_shares` of `60000`.
6. Edit: click the Dinner row → "Edit expense" with the fields filled → `Amount` `1000` → `Save expense` → `Kabir owes you ₹500`. For an uneven split, use a trip with three people and save `1000`: the shares are `33334`, `33333`, `33333`.
7. RLS (supabase-js): as Kabir, `save_expense` editing Aarav's expense → "You can only edit your own expenses"; a direct insert into `expenses` is refused; a non-member reads no rows.
8. Seeded check, read-only: Pondy as Aarav → `₹18,400 spent`, `You're owed ₹7,116.66`, lines `Zoya owes you ₹4,383.33`, `Kabir owes you ₹1,483.33`, `Meera owes you ₹1,250`; the feed starts with `Zoya paid Meera, ₹500, settled up`.
9. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- Needs migration `20261125000000_expenses.sql`; see SKILL.md for using an isolated stack.
- On web `Delete expense` and undo use `window.confirm`.
- Names in Split are first names. Anyone who has left keeps their name (looked up from `profiles`); only a deleted account shows as "Someone".

Last proven: not yet.
