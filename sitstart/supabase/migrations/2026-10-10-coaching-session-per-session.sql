-- Coaching Sessions: one open per scheduled session, not one per student, so a coach can plan several sessions ahead
-- (the user asked, once a student could have several sessions scheduled).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

drop index public.coaching_sessions_one_open;
-- One open coaching session per student, day and start time. One with no date yet (its session was removed) doesn't count.
create unique index coaching_sessions_one_per_session on public.coaching_sessions (student_id, session_date, start_time)
  where submitted_at is null;
