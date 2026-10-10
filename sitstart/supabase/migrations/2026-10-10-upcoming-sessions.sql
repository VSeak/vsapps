-- Several sessions scheduled ahead (another coach asked): a coach who knows they'll meet a student more than once can
-- add them all. The student's Next Session stays on their row (students.next_*); the sessions after it live here.
-- settle_sessions() keeps the two in step: when the Next Session ends it goes to Session History and the earliest one
-- here becomes the Next Session.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

create table public.upcoming_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  session_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  location text not null check (length(trim(location)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (student_id, session_date, start_time)
);
alter table public.upcoming_sessions enable row level security;
grant select, insert, update, delete on public.upcoming_sessions to authenticated;

-- Like the Next Session: staff read them, the student's coach or an admin changes them, the student reads their own.
create policy "staff: read" on public.upcoming_sessions for select to authenticated using ((select public.is_coach()) or (select public.is_admin()));
create policy "staff: add" on public.upcoming_sessions for insert to authenticated
  with check ((select public.is_admin()) or public.can_coach(student_id));
create policy "staff: change" on public.upcoming_sessions for update to authenticated
  using ((select public.is_admin()) or public.can_coach(student_id)) with check ((select public.is_admin()) or public.can_coach(student_id));
create policy "staff: delete" on public.upcoming_sessions for delete to authenticated
  using ((select public.is_admin()) or public.can_coach(student_id));
create policy "student: own upcoming" on public.upcoming_sessions for select to authenticated
  using (student_id = (select public.my_student_id()));

-- Puts a student's scheduled sessions in order. The Next Session becomes the earliest one that hasn't ended (or, when
-- all have ended, the last one, which stays as the ended Next Session until the coach sets a new one, as before);
-- every other ended one goes to Session History; the rest stay in upcoming_sessions. p_now is the caller's local
-- time, since "ended" depends on it (the page works this out the same way, applySchedule). The page calls it when
-- it loads a student whose sessions are out of step and after every change to them.
create function public.settle_sessions(p_student uuid, p_now timestamp) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.students;
  n public.upcoming_sessions;
begin
  if not (public.is_admin() or public.can_coach(p_student)) then
    raise exception 'Only their coach or an admin can change a student''s sessions.';
  end if;
  select * into s from public.students where id = p_student for update;
  if not found then return; end if;
  -- All of them in one place first. The Next Session wins over an upcoming one at the same time.
  if s.next_date is not null then
    insert into public.upcoming_sessions (student_id, session_date, start_time, end_time, location)
      values (s.id, s.next_date, s.next_start, s.next_end, s.next_location)
      on conflict (student_id, session_date, start_time) do update set end_time = excluded.end_time, location = excluded.location;
  end if;
  select * into n from public.upcoming_sessions
    where student_id = p_student and session_date + end_time > p_now order by session_date, start_time limit 1;
  if not found then
    select * into n from public.upcoming_sessions
      where student_id = p_student order by session_date desc, start_time desc limit 1;
  end if;
  if not found then return; end if;   -- nothing scheduled
  insert into public.session_history (student_id, session_date, start_time, end_time, location)
    select student_id, session_date, start_time, end_time, location from public.upcoming_sessions
    where student_id = p_student and id <> n.id and session_date + end_time <= p_now
    on conflict (student_id, session_date, start_time) do nothing;
  delete from public.upcoming_sessions
    where student_id = p_student and (id = n.id or session_date + end_time <= p_now);
  update public.students
    set next_date = n.session_date, next_start = n.start_time, next_end = n.end_time, next_location = n.location
    where id = p_student;
end;
$$;
revoke execute on function public.settle_sessions(uuid, timestamp) from public, anon;
grant execute on function public.settle_sessions(uuid, timestamp) to authenticated;

-- End Coaching clears the next session (the page does) and everything scheduled after it.
create function public.clear_upcoming_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.upcoming_sessions where student_id = new.id;
  return null;
end;
$$;
create trigger clear_upcoming_sessions after update of training_ended_at on public.students
  for each row when (new.training_ended_at is not null and old.training_ended_at is null)
  execute function public.clear_upcoming_sessions();
