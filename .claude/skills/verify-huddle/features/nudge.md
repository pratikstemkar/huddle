# Nudge people

Two places hand a nudge message to the share sheet. Messages hold counts and a link, never names, so they can't leak who marked which day (`nudgeMessage` in `src/lib/trips.ts`). On web without the Web Share API the message is copied instead.

1. **Home hero** (people haven't marked days): on a planning trip with 2+ members and no fixed dates where someone hasn't marked, Pip says "<k> of <n> still need to mark their days for <trip>." and `Nudge them`. Message: `Quick nudge: mark the days you're free for "<trip>" on Huddle: <invite link>`. On web the button reads `Copied` for ~1.8s.
2. **Trip tab Pip** (people haven't voted): when nothing earlier in Pip's list applies (you aren't the organiser with a lockable plan, you've marked and voted, there are other members) and someone hasn't voted: "Waiting on <k> more to vote." and `Nudge`. Message: `Quick nudge: vote on where to go for "<trip>" on Huddle: <invite link>`. On web "Copied" shows under the card.

`<k>` counts every member who hasn't acted, you included.

## Driving it with the built-in browser

Patch `navigator.clipboard.writeText` into `window.__w` before each click (see [invite-share](invite-share.md)).

1. Home: Aarav creates `<PREFIX>nudge` (`Let the group vote`); Kabir joins with its code. Nobody marks days. Sign in as Aarav → `/` → the hero says "2 of 2 still need to mark their days for <PREFIX>nudge." (if no other trip of his matches first) → `Nudge them` → label `Copied`; `window.__w` is `Quick nudge: mark the days you're free for "<PREFIX>nudge" on Huddle: http://localhost:<PORT>/invite/<code>`.
2. Trip Pip: Kabir joins seeded Goa (`goa2027`). Sign in as Meera → Goa → Pip says "Waiting on 1 more to vote." → `Nudge` → "Copied"; `window.__w` is `Quick nudge: vote on where to go for "Goa in March" on Huddle: http://localhost:<PORT>/invite/goa2027`.
3. Cleanup: remove Kabir from Goa (see [join-trip](join-trip.md)) and `db.mjs cleanup aarav@dev.test "$PREFIX"`.

## Not covered here

The native share sheet (`Share.share`) needs a device build. Push nudges are roadmap L4.

Last proven: not yet.
