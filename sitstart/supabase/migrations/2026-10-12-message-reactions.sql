-- Messages: emoji reactions and replies (press and hold a message, like a texting app).
-- reactions holds each person's one emoji for the message ({ "<login id>": "👍" }), set through react_to_message
-- (messages still have no update rule). reply_to is the message a reply answers; deleting that one just drops the quote.
-- Run once in Supabase after 2026-10-10-push-skips-read.sql: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

alter table public.messages
  add column reactions jsonb not null default '{}',
  add column reply_to uuid references public.messages (id) on delete set null;

-- As before, plus: a new message starts with no reactions, and can only reply to a message in its own thread.
create or replace function public.stamp_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();
  new.read_at := null;
  new.pushed_at := null;
  new.reactions := '{}';
  if new.reply_to is not null and not exists
      (select 1 from public.messages where id = new.reply_to and student_id = new.student_id) then
    new.reply_to := null;
  end if;
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

-- Sets, changes or (with an empty p_emoji) removes the caller's own reaction on a message they can read, and
-- returns the message's reactions. Nothing happens for a message in someone else's thread.
create function public.react_to_message(p_message uuid, p_emoji text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(coalesce(p_emoji, '')) > 8 then raise exception 'Pick one emoji.'; end if;
  update public.messages m
    set reactions = case when coalesce(p_emoji, '') = '' then m.reactions - auth.uid()::text
      else m.reactions || jsonb_build_object(auth.uid()::text, p_emoji) end
    where m.id = p_message and (m.student_id = public.my_student_id() or public.can_coach(m.student_id))
    returning m.reactions into r;
  return r;
end;
$$;
revoke execute on function public.react_to_message(uuid, text) from public, anon;
grant execute on function public.react_to_message(uuid, text) to authenticated;
