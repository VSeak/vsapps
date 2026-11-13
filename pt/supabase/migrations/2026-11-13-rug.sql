-- PT Pal's rug (the user asked): Settings → Rug picks which rug the pal stands on. Null = the braided oval it always had.
-- The page knows the names; the check keeps it to a short plain word so nothing odd lands in a class name.
-- Same owner-only rule as the rest of pt_settings (its existing policy and grant cover new columns).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.pt_settings
  add column if not exists rug text check (rug ~ '^[a-z]{1,20}$');
