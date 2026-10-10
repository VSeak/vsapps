-- Messages: texting between a student and their coach, one thread per student (apart from plan notes, which stay on
-- a session). A message is never edited; its sender can delete it. read_at is when the other side first saw it.
-- Push notifications: each device that turned them on has a push_subscriptions row, and the message-push Edge Function
-- (supabase/functions/message-push) sends to them. SETUP.md has the steps.
-- Run once in Supabase after 2026-10-10-delete-uninvited-student.sql: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,   -- the message outlives the login
  from_coach boolean not null default false,
  author_name text not null default '',   -- a coach's name on their messages (stamp_message); empty for students
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,                     -- mark_messages_read, by the other side
  pushed_at timestamptz                    -- push_targets, so a message is pushed once
);
create index on public.messages (student_id, created_at);

-- Who sent it and when come from the server (nobody can post as someone else). A coach's message is signed with
-- their name, since students can't read staff. A student with no coach can't send: nobody would get it.
create function public.stamp_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  new.read_at := null;
  new.pushed_at := null;
  if new.from_coach then
    new.author_name := coalesce((select nullif(name, '') from public.staff where email = lower(auth.jwt() ->> 'email')), '');
  else
    new.author_name := '';
    if not exists (select 1 from public.students where id = new.student_id and coach_id is not null) then
      raise exception 'You don''t have a coach right now, so there is nobody to message.';
    end if;
  end if;
  return new;
end;
$$;
create trigger stamp_message before insert on public.messages
  for each row execute function public.stamp_message();

-- A student reads and sends in their own thread. Only the student's coach (or any coach, for a student with no coach:
-- can_coach) reads and sends on the coach side; other coaches and admins never see a thread. Nobody changes a message
-- (no update rule: read_at and pushed_at are set by the functions below); its sender can delete it.
alter table public.messages enable row level security;
grant select, insert, delete on public.messages to authenticated;
create policy "student: read" on public.messages for select to authenticated
  using (student_id = (select public.my_student_id()));
create policy "student: send" on public.messages for insert to authenticated
  with check (not from_coach and student_id = (select public.my_student_id()));
create policy "coach: read" on public.messages for select to authenticated
  using (public.can_coach(student_id));
create policy "coach: send" on public.messages for insert to authenticated
  with check (from_coach and public.can_coach(student_id));
create policy "sender: delete" on public.messages for delete to authenticated
  using (author_id = (select auth.uid()));

-- Opening a thread marks the other side's messages read: the student reads the coach's, the coach the student's.
create function public.mark_messages_read(p_student uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.messages set read_at = now()
  where student_id = p_student and read_at is null
    and ((from_coach and p_student = public.my_student_id()) or (not from_coach and public.can_coach(p_student)));
$$;
revoke execute on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- The page hears about new messages as they arrive (Supabase Realtime), under the same read rules.
alter publication supabase_realtime add table public.messages;

-- One row per device that turned notifications on (the browser's push address and keys). No rules: the page saves and
-- removes its own through the two functions below, and only the Edge Function (service role) reads them.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 2000),
  p256dh text not null check (length(p256dh) <= 200),
  auth_key text not null check (length(auth_key) <= 100),
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- This device now belongs to the signed-in person (a shared phone moves to whoever signed in last).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_agent text default '') returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_agent, ''), 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_key = excluded.auth_key,
    user_agent = excluded.user_agent;
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Turn Off, and Sign Out: this device stops getting the signed-in person's notifications.
create function public.drop_push_subscription(p_endpoint text) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke execute on function public.drop_push_subscription(text) from public, anon;
grant execute on function public.drop_push_subscription(text) to authenticated;

-- For the message-push Edge Function only (service role): the devices to notify about a message, with what the
-- notification says and where it opens. A coach's message goes to the student; a student's goes to their coach.
-- p_caller must be the sender, and a message is handed out once (pushed_at), so nobody can make it ring twice.
create function public.push_targets(p_message uuid, p_caller uuid)
returns table (endpoint text, p256dh text, auth_key text, title text, body text, path text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.messages;
  s public.students;
  who uuid;
  is_staff boolean;
begin
  update public.messages x set pushed_at = now()
    where x.id = p_message and x.author_id = p_caller and x.pushed_at is null returning x.* into m;
  if m.id is null then return; end if;
  select * into s from public.students st where st.id = m.student_id;
  if m.from_coach then
    who := s.user_id;
    -- Staff who are also students open their own thread under My Training.
    is_staff := exists (select 1 from public.staff a where a.email = s.email and a.deactivated_at is null);
  else
    select u.id into who from public.staff a join auth.users u on lower(u.email) = a.email
      where a.id = s.coach_id and a.deactivated_at is null;
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
revoke execute on function public.push_targets(uuid, uuid) from public, anon, authenticated;
grant execute on function public.push_targets(uuid, uuid) to service_role;

-- The Edge Function removes a device whose push address has stopped working.
grant select, delete on public.push_subscriptions to service_role;
