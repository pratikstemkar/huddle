# Edit my profile

The You tab (`/profile`; also the `Your profile` avatar on the Trips tab): header `Signed in as <email>` and "You", a card with the avatar preview (`Avatar preview, <name>`, "This is how your trip-mates see you."), `Your name` (max 40), `Avatar colour` radios (`Iris`, `Beak yellow`, `Mint`, `Blush`, `Coral`), and `Save profile`. If the profile has a sign-in photo (`avatar_url` from Google/Apple), the radios are replaced by `Use my initial instead`, which clears the photo on save. Below: `Privacy policy`, `Delete account`, `Sign out`, and the app version.

Saving stays on the tab and shows "Saved"; the Trips tab greeting and avatar update on focus. An empty name shows "Add your name first."; a failed save "Couldn't save your profile. Check your connection and try again."

Avatars (`src/components/ui/avatar.tsx`) show the photo, else the initial on the chosen colour's tint, else on a fallback.

## What the database enforces (`…_edit_profile.sql`, `…_huddle_colours.sql`)

- `profiles.avatar_color` in `iris`, `beak`, `mint`, `blush`, `coral` (or null); old keys are remapped by a trigger.
- `display_name` trimmed length 1–40 on every write.
- `authenticated` can update only `display_name`, `avatar_url`, `avatar_color`, and only on its own row.

## Driving it

1. Record the user's row: `select id, display_name, avatar_url, avatar_color from profiles where id = …` (read-only psql via `docker exec supabase_db_<project> psql`).
2. Sign in as Zoya → `You` tab → triple-click `Your name`, type `Zoya Khan` → `Blush` → `Save profile` → "Saved" appears; the preview label is `Avatar preview, Zoya Khan`.
3. DB: Zoya's row has the new name and `avatar_color = blush`.
4. Trip-mate view: as Kabir open Pondy long weekend (both are members) → the invite sheet's "In the huddle" list shows `Zoya Khan` (open it with `Invite people`).
5. Cleanup: restore the seeded row (`display_name = 'Zoya', avatar_color = null`). Seeded users are shared; always put them back.

## Gotchas

- Avatar initials are hidden from accessibility (the row or button carries the label), so `get_page_text` shows them but `find` won't.
- Profiles aren't on realtime; other members see a rename next time their screen loads.

Last proven: not yet on the redesigned screen (last run on the old UI: 2026-11-12).
