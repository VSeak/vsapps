-- Saved timer notes (the user asked): one short optional note per saved timer for the setup the numbers don't hold
-- (edge, grip, added weight), shown under its name in the list.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.saved_timers add column if not exists note text;
alter table public.saved_timers drop constraint if exists saved_timers_note_check;
alter table public.saved_timers add constraint saved_timers_note_check check (length(note) <= 200);
