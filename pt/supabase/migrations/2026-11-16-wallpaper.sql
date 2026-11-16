-- PT Pal's wallpaper (the user asked, set up like the rug): Settings → Wallpaper picks the paper on the room's wall.
-- Null = the peach pinstripe it always had. The page knows the names; the check keeps it to a short plain word so nothing
-- odd lands in a class name.
-- Same owner-only rule as the rest of pt_settings (its existing policy and grant cover new columns).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.pt_settings
  add column if not exists wall text check (wall ~ '^[a-z]{1,20}$');
