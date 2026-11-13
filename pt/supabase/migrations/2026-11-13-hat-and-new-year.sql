-- PT Pal at Christmas (the user asked): the owner places a Santa hat on their own photo, and a New Year screen
-- ("<last year> in Berries") shows once, the first time the app is opened in a new year, on any device.
-- hat: where the hat sits, as fractions of the photo (x and y = the middle of its fur band, w = its width, r = tilt in
--   degrees). Null = not placed: no hat on a photo, the fox's own spot on the drawing. A new photo sets it back to null.
-- year_seen: the year whose New Year screen has been shown (2027 = the 2026 screen was shown in 2027). Null = never.
-- Same owner-only rule as the rest of pt_settings (its existing policy and grant cover new columns).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.pt_settings
  add column if not exists hat jsonb check (hat is null or (jsonb_typeof(hat) = 'object' and length(hat::text) <= 200)),
  add column if not exists year_seen int check (year_seen between 2000 and 3000);
