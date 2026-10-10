-- Push notifications: no notification for a message the other side has already read. The message-push Edge Function
-- now waits a moment before asking; someone with the thread open on their screen marks it read at once, so their
-- phone doesn't buzz for a message they are looking at. Paste the new supabase/functions/message-push/index.ts too.
-- Run once in Supabase after 2026-10-10-messages.sql: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

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
