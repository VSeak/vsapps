-- PT Pal's window (the user asked): the sky outside follows the real sunrise and sunset where the owner is.
-- The page asks the phone for its location once (Settings → Use My Location) and saves it rounded to 0.1° (about 10 km):
-- plenty for sunrise times, and not an address. Null = not set; the window then uses 7am and 7pm.
-- Same owner-only rule as the rest of pt_settings (its existing policy and grant cover new columns).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.pt_settings
  add column if not exists lat numeric(4, 1) check (lat between -90 and 90),
  add column if not exists lon numeric(4, 1) check (lon between -180 and 180);
