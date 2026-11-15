# Settle up

`Settle up` on the Split tab's balance card (only when you're not square; hint "Record a payment") opens `/trip/<id>/settle` ("Settle up"): "Paid someone back? Record it here. You can record part of it." One card per line that involves you:

- `You owe <name>` with the amount, an amount field prefilled with the full amount (`Amount, You owe <name>`), and `I paid <name>`.
- `<name> owes you` with the amount, `Amount, <name> owes you`, and `<name> paid me`.

Recording closes the sheet; the Split tab shows the payment as `<A> paid <B>, <amount>, settled up` and the balances move. When a payment brings you to zero, Pip on the balance card cheers once. With nothing to settle: "You're all square. Nothing to settle." and `Close`.

Your own payments in the feed are buttons: confirm "Undo this payment? It comes off the balances for everyone." → `Undo` (browser confirm on web) deletes it; failure shows "Couldn't undo that payment. Check your connection and try again."

## Sub-features

- Partial payments: any amount up to what's owed. More → "That's more than you owe <name>. The most is ₹…" / "That's more than <name> owes you. The most is ₹…". Not a number → "Enter an amount, like <owed>."
- Failure → "Couldn't record that payment. Check your connection and try again."

## What the database enforces (`…_expenses.sql`)

- `settlements` insert ("record a settlement you're part of"): `created_by` is you, you are `from_user` or `to_user`, you're a member, and both people are in the trip's money (`in_trip_money`: a member, or someone who left but has an expense, share or payment there). `from_user <> to_user`, `0 < amount`.
- Delete ("undo own settlement"): only the person who recorded it, while a member. No updates.

## Driving it

1. Setup as in [add-expense](add-expense.md): `<PREFIX>split`, Kabir joined, Aarav's `Dinner` ₹1,200 split 2 ways.
2. Sign in as Kabir → trip → `Split` → `You owe ₹600`, `You owe Aarav ₹600` → `Settle up` → URL `/trip/<id>/settle`, card `You owe Aarav`.
3. Set `Amount, You owe Aarav` to `700` → `I paid Aarav` → "That's more than you owe Aarav. The most is ₹600."
4. Set it to `200` → `I paid Aarav` → back on Split: `You owe ₹400`, feed starts `You paid Aarav, ₹200, settled up`.
5. DB (psql select): one `settlements` row `from_user` Kabir, `to_user` Aarav, `amount_minor = 20000`, `created_by` Kabir.
6. Click `You paid Aarav, ₹200, settled up` → accept the confirm → the row is gone, `You owe ₹600` again.
7. `Settle up` → `I paid Aarav` with the prefilled `600` → `You're all square`, no `Settle up` button.
8. As Aarav: the feed shows `Kabir paid you, ₹600, settled up`, not a button (Aarav didn't record it). RLS (supabase-js as Aarav): deleting Kabir's settlement removes nothing; inserting one between Kabir and Zoya is refused.
9. Cleanup: `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Gotchas

- Don't record payments on the seeded Pondy trip unless you undo them; its balances are what other docs check.

Last proven: not yet.
