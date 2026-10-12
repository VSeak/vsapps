-- Messages: one thread per student AND coach, for privacy (the user asked). Before, a student had one thread that a
-- new coach inherited whole. Now messages.coach_id says whose thread a message is in: a new coach starts empty and
-- never sees what the student and an earlier coach wrote. A coach reads only their own threads (and keeps reading one
-- after they stop coaching the student, without sending); a student reads all of theirs, and sends only to their
-- current coach. A student with no coach can't be messaged by anyone.
-- Run once in Supabase after 2026-10-12-message-reactions.sql: SQL Editor → New query → paste → Run.
-- Run it BEFORE the page that uses it goes live. (schema.sql already includes this for a fresh project.)

alter table public.messages add column coach_id uuid references public.staff (id) on delete set null;
create index on public.messages (student_id, coach_id, created_at);

-- Messages so far: a coach's go in that coach's thread; a student's in the thread of the coach they had then
-- (student_coaches), else their coach now.
update public.messages m set coach_id = coalesce(
  case when m.from_coach then
    (select a.id from public.staff a join auth.users u on lower(u.email) = a.email where u.id = m.author_id) end,
  (select c.staff_id from public.student_coaches c
    where c.student_id = m.student_id and c.staff_id is not null
      and c.started_at <= m.created_at and (c.ended_at is null or c.ended_at > m.created_at)
    order by c.started_at desc limit 1),
  (select st.coach_id from public.students st where st.id = m.student_id));

-- As before, plus: the message goes in the thread of the student's coach right now, only that coach sends on the
-- coach side, and a reply answers a message in the same thread.
create or replace function public.stamp_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  new.read_at := null;
  new.pushed_at := null;
  new.reactions := '{}';
  new.coach_id := (select coach_id from public.students where id = new.student_id);
  if new.from_coach then
    if new.coach_id is null or new.coach_id is distinct from public.my_staff_id() then
      raise exception 'Only this student''s coach can message them.';
    end if;
    new.author_name := coalesce((select nullif(name, '') from public.staff where email = lower(auth.jwt() ->> 'email')), '');
  else
    new.author_name := '';
    if new.coach_id is null then
      raise exception 'You don''t have a coach right now, so there is nobody to message.';
    end if;
  end if;
  if new.reply_to is not null and not exists
      (select 1 from public.messages where id = new.reply_to and student_id = new.student_id and coach_id = new.coach_id) then
    new.reply_to := null;
  end if;
  return new;
end;
$$;

drop policy "coach: read" on public.messages;
drop policy "coach: send" on public.messages;
create policy "coach: read" on public.messages for select to authenticated
  using (coach_id = (select public.my_staff_id()) and (select public.is_coach()));
create policy "coach: send" on public.messages for insert to authenticated
  with check (from_coach and coach_id = (select public.my_staff_id()) and (select public.is_coach()));

-- Opening a thread marks the other side's messages in it read. p_coach: whose thread (null for one whose coach is gone).
drop function public.mark_messages_read(uuid);
create function public.mark_messages_read(p_student uuid, p_coach uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.messages set read_at = now()
  where student_id = p_student and coach_id is not distinct from p_coach and read_at is null
    and ((from_coach and p_student = public.my_student_id())
      or (not from_coach and coach_id = public.my_staff_id() and public.is_coach()));
$$;
revoke execute on function public.mark_messages_read(uuid, uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;

-- A student's own threads, latest first: one per coach they have messages with, and that coach's name (students
-- can't read staff). The page shows them as tabs when there is more than one.
create function public.message_threads(p_student uuid)
returns table (coach_id uuid, coach_name text, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.coach_id, coalesce(max(nullif(a.name, '')), max(nullif(m.author_name, '')), ''), max(m.created_at)
  from public.messages m left join public.staff a on a.id = m.coach_id
  where m.student_id = p_student and p_student = public.my_student_id()
  group by m.coach_id
  order by 3 desc;
$$;
revoke execute on function public.message_threads(uuid) from public, anon;
grant execute on function public.message_threads(uuid) to authenticated;

-- Reactions: on a message in a thread the caller can read.
create or replace function public.react_to_message(p_message uuid, p_emoji text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(coalesce(p_emoji, '')) > 8 then raise exception 'Pick one emoji.'; end if;
  update public.messages m
    set reactions = case when coalesce(p_emoji, '') = '' then m.reactions - auth.uid()::text
      else m.reactions || jsonb_build_object(auth.uid()::text, p_emoji) end
    where m.id = p_message
      and (m.student_id = public.my_student_id() or (m.coach_id = public.my_staff_id() and public.is_coach()))
    returning m.reactions into r;
  return r;
end;
$$;

-- Push: a student's message rings the coach whose thread it is in (m.coach_id), not whoever coaches them now.
create or replace function public.push_targets(p_message uuid, p_caller uuid)
returns table (endpoint text, p256dh text, auth_key text, title text, body text, path text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.messages;
  s public.students;
  who uuid;
  is_staff boolean;
begin
  update public.messages x set pushed_at = now()
    where x.id = p_message and x.author_id = p_caller and x.pushed_at is null and x.read_at is null returning x.* into m;
  if m.id is null then return; end if;
  select * into s from public.students st where st.id = m.student_id;
  if m.from_coach then
    who := s.user_id;
    -- Staff who are also students open their own thread under My Training.
    is_staff := exists (select 1 from public.staff a where a.email = s.email and a.deactivated_at is null);
  else
    select u.id into who from public.staff a join auth.users u on lower(u.email) = a.email
      where a.id = m.coach_id and a.deactivated_at is null;
  end if;
  if who is null then return; end if;
  return query
    select p.endpoint, p.p256dh, p.auth_key,
      case when m.from_coach then coalesce(nullif(m.author_name, ''), 'Your coach') else s.name end,
      left(replace(m.body, '**', ''), 160),
      case when not m.from_coach then '#/messages/' || s.id when is_staff then '#/me/messages' else '#/messages' end
    from public.push_subscriptions p where p.user_id = who;
end;
$$;
