-- Delete Student also works for a student who was never invited (no invite sent, never signed in), even while
-- they are still being coached: there is nothing of theirs to archive yet. Everyone else still needs End Coaching first.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- (schema.sql already includes this for a fresh project.)

create or replace function public.delete_student(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  s public.students;
begin
  if not (public.is_admin() or public.can_coach(p_id)) then
    raise exception 'Only an admin or their coach can delete a student.';
  end if;
  if exists (select 1 from public.students where id = p_id and training_ended_at is null
      and (invited_at is not null or user_id is not null)) then
    raise exception 'End their coaching before deleting them.';
  end if;
  delete from public.students where id = p_id returning * into s;
  if s.id is null then return; end if;
  -- Their login: the claimed one, or one made by an invite they never opened.
  delete from auth.users u
  where (u.id = s.user_id or (s.email is not null and lower(u.email) = s.email))
    and not exists (select 1 from public.staff a where a.email = lower(u.email))
    and not public.login_in_other_app(u.email);
end;
$$;
