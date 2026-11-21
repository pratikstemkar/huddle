# Notifications (Activity and push)

Rows in `notifications` (migration `…_notifications.sql`) are both the in-app Activity list and pending pushes. Triggers record them for: trip, group and hangout invites; a trip locked; a hangout locked or cancelled; someone joining a trip you organise; and nudges ([nudge](nudge.md)). Nothing is recorded without a signed-in user (seed data). The `send-push` edge function drains pending rows to Expo.

- **Home:** the bell left of the avatar, `Activity` or `Activity, <n> unread` → `/activity`.
- **`/activity`:** rows labelled `[Unread. ]<title>. <body>. <time>`; tapping marks it read and opens its `url`. `Mark all read`. On a phone without push: `Turn on notifications` / `Open Settings` card. Empty: "Nothing yet. Invites, nudges and locked plans show up here."
- **You tab (`/profile`) → Notifications:** switches `Invites`, `Plans settled`, `Nudges`, `People joining` (`notification_prefs`). Off means push is skipped (`push_status = 'skipped'`); Activity still lists it. On web a line explains push is phone-only.
- **Trip screen:** the first time a phone opens a trip, a confirm sheet "Get a ping when the plan moves?" asks before the system prompt (native only, once per phone).

## Driving it with the built-in browser

The migration adds tables, cron and Vault use: verify on an isolated stack (AGENTS.md).

1. As Aarav (SQL as him, or the app): lock Goa → sign in as Meera → bell reads `Activity, 1 unread` → `/activity` shows "Goa in March is happening / Palolem Beach · <dates>" → tap → `/trip/<goa>` (and the lock celebration) → `read_at` set.
2. You tab → turn `Nudges` off → `notification_prefs.nudges = false`.

## Push delivery without a phone

On the isolated stack, add to its `config.toml`:

```toml
[edge_runtime.secrets]
PUSH_SECRET = "local-push-secret"
EXPO_PUSH_URL = "http://host.docker.internal:<port>/push"
EXPO_RECEIPTS_URL = "http://host.docker.internal:<port>/receipts"
```

run a small server on `<port>` that answers `{ data: [{ status: 'ok', id }] }` per message, restart the stack, then in SQL:

```sql
select vault.create_secret('http://supabase_kong_huddle-slot-<N>:8000/functions/v1/send-push', 'push_function_url');
select vault.create_secret('local-push-secret', 'push_function_secret');
insert into push_tokens (token, user_id, platform) values ('ExponentPushToken[test]', '<user id>', 'android');
```

Any event for that user then reaches the fake server within a second or two (`net._http_response` shows the function's summary; `push_tickets` holds the ticket).

## Not covered here

Real delivery, the permission prompt, banners while open, the badge and tapping a push all need a development build with Firebase (Android) or APNs (iOS) set up (CONTRIBUTING.md → Push notifications).

Last proven: 2026-11-21 (web + SQL + function against a fake Expo, isolated stack).
