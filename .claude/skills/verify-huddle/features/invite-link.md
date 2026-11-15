# Invite link (new or signed-out friend)

Shared invites link to `/invite/<code>` (`inviteLink()`): `<page origin>/invite/<code>` on web, `EXPO_PUBLIC_APP_URL/invite/<code>` in native builds, `huddle://invite/<code>` in native dev builds with no `EXPO_PUBLIC_APP_URL`. The route sits outside both auth guards, so it opens signed in or out. It uses the same welcome scene as sign-in.

- **Signed in:** redirects straight to `/join?code=<code>` (the Invites tab, code filled in, not yet joined).
- **Signed out:** saves the code (AsyncStorage key `huddle.pendingInvite`), calls `invite_preview(code)` and shows "You’re invited to", the trip name, "<n> people are going" (or "1 person is going") and `Sign in to join` → `/sign-in`. After any sign-in, the `(app)` layout takes the saved code once and pushes `/join?code=<code>`.
- **Unknown code:** "This invite doesn’t work" + `Go to Huddle`; the saved code is dropped so sign-in lands on home.
- **Preview unreachable:** "a trip on Huddle"; the code is still kept.

`invite_preview` is `security definer`, callable by `anon`, and returns only name, colour and member count.

## Driving it with the built-in browser

1. Signed out, navigate to `/invite/nope1234` → "This invite doesn’t work".
2. Navigate to `/invite/goa2027` → "Goa in March", "2 people are going". `localStorage['huddle.pendingInvite']` is `goa2027`.
3. Click `Sign in to join` → `/sign-in` → `Sign in as Kabir` → URL `/join?code=goa2027`, `Invite code` value `goa2027`, storage key gone.
4. `Join trip` → `/trip/aaaaaaaa-…0001`; the header shows `3 people in the huddle`.
5. Signed in as Kabir, navigate to `/invite/goa2027` → straight to `/join?code=goa2027`.
6. As Aarav on the Goa trip, intercept the invite sheet's `Share` (see [invite-share](invite-share.md)) → link is `http://localhost:<PORT>/invite/goa2027`.

## Cleanup

Same as [join-trip](join-trip.md): delete Kabir's `trip_members` row on the seed Goa trip as Kabir.

## Not covered here

Universal links (iOS) and app links (Android) need the hosted domain from L1, the real Apple Team ID / Android SHA256 in `public/.well-known/`, and a device build. Not provable on web.

Last proven: not yet on the redesigned screens (last run on the old UI: 2026-11-12).
