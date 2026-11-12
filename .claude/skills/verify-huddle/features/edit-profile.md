# Edit my profile

Home avatar (`Your profile`) → `/profile` (form sheet): an avatar preview, `Your name` (max 40), `Avatar colour` radios (`Sunset` … `Sky`), `Save profile`, and `Sign out`. If the profile has a sign-in photo (`avatar_url` from Google/Apple), the colour radios are replaced by `Use my initial instead`, which clears the photo on save. Saving closes the sheet; the home greeting and avatar update.

Avatars (`src/components/ui/avatar.tsx`) show the photo, else the initial on the chosen colour, else on a fallback (the trip colour in member lists, `celebrate` on home).

## What the database enforces (`…_edit_profile.sql`)

- `profiles.avatar_color` in the six palette colours (or null).
- `display_name` trimmed length 1–40 on every write (`not valid`, so older long names don't block the migration).
- `authenticated` can update only `display_name`, `avatar_url`, `avatar_color`, and only on its own row ("edit own profile" with `with check`).
- New sign-ups get names trimmed and cut to 40.

## Driving it

1. Record the user's row: `select id, display_name, avatar_url, avatar_color from profiles where id = …` (via `docker exec supabase_db_<project> psql`).
2. Sign in as Zoya → `Your profile` → triple-click `Your name`, type `Zoya Khan` → `Plum` → `Save profile` → lands on `/`; avatar is plum.
3. DB: Zoya's row has the new name and `avatar_color = plum`.
4. Trip-mate view (setup via supabase-js): Zoya creates `<PREFIX>profile`, Kabir joins; Kabir's `trip_members … profiles(display_name, avatar_url, avatar_color)` shows the new name and colour; Kabir updating Zoya's profile returns no rows. In the UI, `Who's going` shows Zoya in plum and Kabir on the trip colour.
5. Cleanup: `db.mjs cleanup zoya@dev.test <PREFIX>` and restore the seeded row (`display_name = 'Zoya', avatar_color = null`). Seeded users are shared; always put them back.

## Gotchas

- The avatar initial is hidden from accessibility (the button or row carries the label), so `get_page_text` shows it but `find` won't.
- Profiles aren't on realtime; other members see a rename next time their trip screen loads.
- SQL checks (other user's row, `created_at`, 41-char/blank name, bad colour) were run as `authenticated` in psql.

Last proven: 2026-11-12 (Zoya via UI, DB row, Kabir RLS).
